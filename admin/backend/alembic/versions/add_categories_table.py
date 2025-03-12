"""Add categories table and category_id to goods

Revision ID: a5b1c3d4e5f6
Revises: 
Create Date: 2023-11-08 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import logging

# revision identifiers, used by Alembic.
revision = 'a5b1c3d4e5f6'
down_revision = None
branch_labels = None
depends_on = None

# Настраиваем логирование
logger = logging.getLogger("alembic.migration")

def table_exists(table_name):
    """Проверяет, существует ли таблица"""
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    return table_name in inspector.get_table_names()

def column_exists(table_name, column_name):
    """Проверяет, существует ли колонка в таблице"""
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    has_table = table_name in inspector.get_table_names()
    if not has_table:
        return False
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    try:
        # Создаем таблицу alembic_version если её нет
        if not inspector.has_table("alembic_version"):
            with conn.begin_nested():
                op.create_table(
                    'alembic_version',
                    sa.Column('version_num', sa.String(32), nullable=False),
                    sa.PrimaryKeyConstraint('version_num')
                )

        # Создаем таблицу категорий если не существует
        if not inspector.has_table('categories'):
            with conn.begin_nested():
                op.create_table('categories',
                    sa.Column('id', sa.Integer(), nullable=False),
                    sa.Column('name', sa.String(), nullable=False),
                    sa.Column('description', sa.Text(), nullable=True),
                    sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
                    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
                    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
                    sa.PrimaryKeyConstraint('id')
                )

        # Добавляем колонку category_id если её нет
        if not any(col['name'] == 'category_id' for col in inspector.get_columns('goods')):
            with conn.begin_nested():
                op.add_column('goods', sa.Column('category_id', sa.Integer(), nullable=True))

        # Создаем внешний ключ если его нет
        if not any(fk['name'] == 'fk_goods_category_id' for fk in inspector.get_foreign_keys('goods')):
            with conn.begin_nested(), op.batch_alter_table('goods') as batch_op:
                batch_op.create_foreign_key(
                    'fk_goods_category_id', 
                    'categories', 
                    ['category_id'], 
                    ['id'], 
                    ondelete='SET NULL'
                )

        # Добавляем версию миграции
        with conn.begin_nested():
            conn.execute(sa.text(
                "INSERT INTO alembic_version (version_num) VALUES (:rev) ON CONFLICT DO NOTHING"
            ), {'rev': revision})

    except Exception as e:
        logger.error(f"Migration error: {str(e)}")
        conn.rollback()
        raise


def downgrade():
    """Отмена миграции"""
    try:
        # Удаляем внешний ключ
        if column_exists('goods', 'category_id'):
            with op.batch_alter_table('goods', schema=None) as batch_op:
                batch_op.drop_constraint('fk_goods_category_id', type_='foreignkey')
            logger.info("Внешний ключ fk_goods_category_id удален")

        # Удаляем колонку category_id
        if column_exists('goods', 'category_id'):
            op.drop_column('goods', 'category_id')
            logger.info("Колонка category_id удалена")
        
        # Удаляем индексы
        op.drop_index(op.f('ix_categories_id'), table_name='categories')
        logger.info("Индекс ix_categories_id удален")
        
        # Удаляем таблицу категорий
        if table_exists('categories'):
            op.drop_table('categories')
            logger.info("Таблица categories удалена")
            
        # Удаляем версию
        op.execute("DELETE FROM alembic_version WHERE version_num = 'a5b1c3d4e5f6'")
    except Exception as e:
        logger.error(f"Ошибка при отмене миграции: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise 