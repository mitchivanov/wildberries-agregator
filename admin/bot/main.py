import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set
import json
import aiohttp
import csv
import time
import random
import string
import pytz

from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, StateFilter
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest, TelegramForbiddenError
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage

from fastapi import FastAPI, Request, HTTPException
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# Путь к CSV файлу с пользователями
USERS_CSV_PATH = os.path.join(os.path.dirname(__file__), 'users.csv')
# Путь к файлу для сохранения рассылок
BROADCASTS_PATH = os.path.join(os.path.dirname(__file__), 'broadcasts.json')

SUPER_ADMIN_IDS = os.getenv("SUPER_ADMIN_IDS", "").split(',')
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "")
TELEGRAM_WEBAPP_URL = os.getenv("TELEGRAM_WEBAPP_URL", "") + "?startapp=1"  # Добавляем параметр для инициализации
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('telegram_bot')

# Создаем FastAPI приложение для обработки запросов от бэкенда
app = FastAPI()

# Настройка CORS для API бота
app.add_middleware(
    CORSMiddleware,
    allow_origins=[f"{TELEGRAM_WEBAPP_URL}"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создаем хранилище для состояний FSM
storage = MemoryStorage()
bot = Bot(token=TELEGRAM_BOT_TOKEN)
dp = Dispatcher(storage=storage)

# Определяем московский часовой пояс
MOSCOW_TZ = pytz.timezone('Europe/Moscow')

# Функции для работы с CSV файлом пользователей

async def read_users_csv():
    """Чтение файла CSV с пользователями"""
    users = []
    try:
        with open(USERS_CSV_PATH, mode='r', encoding='utf-8-sig') as csvfile:  # Изменено с 'utf-8' на 'utf-8-sig'
            # Явно указываем разделитель и заголовки, чтобы избежать проблем с распознаванием
            reader = csv.DictReader(csvfile, delimiter=';')
            for row in reader:
                # Убеждаемся, что все ключи присутствуют и корректно обработаны
                user_data = {}
                for key, value in row.items():
                    # Удаляем кавычки, если они есть
                    clean_key = key.strip('"')
                    clean_value = value.strip('"') if value else ""
                    user_data[clean_key] = clean_value
                users.append(user_data)
        return users
    except Exception as e:
        logger.error(f"Ошибка при чтении CSV файла пользователей: {e}")
        logger.exception("Подробная информация об ошибке:")
        return []

async def write_users_csv(users):
    """Запись в файл CSV с пользователями"""
    try:
        # Проверка прав доступа к файлу
        file_exists = os.path.exists(USERS_CSV_PATH)
        file_writable = os.access(USERS_CSV_PATH, os.W_OK) if file_exists else os.access(os.path.dirname(USERS_CSV_PATH), os.W_OK)
        logger.info(f"CSV файл существует: {file_exists}, доступен для записи: {file_writable}")
        
        # Берем заголовки из первой строки исходного файла
        with open(USERS_CSV_PATH, mode='r', encoding='utf-8-sig') as csvfile:
            first_line = csvfile.readline().strip()
            fieldnames = first_line.split(';')
            # Удаляем кавычки из заголовков
            fieldnames = [field.strip('"') for field in fieldnames]
            
            # Проверяем наличие всех необходимых полей
            logger.info(f"Доступные поля в CSV: {fieldnames}")
            logger.info(f"Количество пользователей для сохранения: {len(users)}")
            
            # Обработка пользователей - корректировка кода
            processed_users = []
            for user in users:
                processed_user = {}
                for field in fieldnames:
                    # Правильно сопоставляем поля, учитывая возможность BOM-маркера
                    field_key = field
                    if field.startswith('\ufeff'):
                        field_key = field[1:]  # Удаляем BOM-маркер, если он есть
                    
                    # Получаем значение поля, если оно существует
                    processed_user[field] = user.get(field_key, "")
                processed_users.append(processed_user)
            
            logger.info(f"Количество обработанных пользователей: {len(processed_users)}")
            if len(processed_users) > 0:
                logger.info(f"Первый пользователь: {processed_users[0]}")
        
        # Записываем обновленные данные
        with open(USERS_CSV_PATH, mode='w', encoding='utf-8', newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, delimiter=';', quoting=csv.QUOTE_MINIMAL)
            writer.writeheader()
            writer.writerows(processed_users)
            # Принудительно сбрасываем буфер на диск
            csvfile.flush()
            os.fsync(csvfile.fileno())
            
        logger.info(f"Пользователи успешно записаны в CSV файл")
        return True
    except Exception as e:
        logger.error(f"Ошибка при записи в CSV файл пользователей: {e}")
        logger.exception("Подробная информация об ошибке:")
        return False

def generate_unique_id():
    """Генерирует уникальный ID для нового пользователя в формате 'xxx'"""
    # Создаем комбинацию из 1-3 символов (буквы и цифры)
    chars = string.ascii_lowercase + string.digits
    unique_id = ''.join(random.choice(chars) for _ in range(3))
    
    return unique_id

async def get_or_create_user(user_id: int, username: str, first_name: str, last_name: str):
    """Получение или создание пользователя в CSV файле"""
    try:
        # Читаем текущих пользователей
        users = await read_users_csv()
        logger.info(f"Прочитано пользователей: {len(users)}")
        
        # Получаем структуру CSV файла
        with open(USERS_CSV_PATH, mode='r', encoding='utf-8-sig') as csvfile:
            first_line = csvfile.readline().strip()
            fieldnames = first_line.split(';')
            fieldnames = [field.strip('"') for field in fieldnames]
        
        # Исправляем id поле, если оно содержит BOM-маркер
        id_field = fieldnames[0]
        if id_field.startswith('\ufeff'):
            id_field = id_field[1:]
        
        # Ищем пользователя по очищенному id полю
        user_found = False
        for user in users:
            if user.get(id_field) == str(user_id):
                user_found = True
                logger.info(f"Найден существующий пользователь: {user_id}")
                # Обновляем данные пользователя
                user["name"] = f"{first_name} {last_name}".strip()
                user["first_name"] = first_name
                user["last_name"] = last_name
                user["last_contact_at"] = str(int(time.time()))
                
                # Сохраняем изменения
                success = await write_users_csv(users)
                if not success:
                    logger.error(f"Не удалось обновить данные пользователя {user_id}")
                break
        
        # Если пользователь не найден, создаем нового
        if not user_found:
            logger.info(f"Создан новый пользователь: {user_id}")
            
            # Создаем новый уникальный CUser_ID
            cuser_id = f"8q18.{generate_unique_id()}"
            
            # Создаем нового пользователя со всеми необходимыми полями
            new_user = {}
            for field in fieldnames:
                clean_field = field
                if field.startswith('\ufeff'):
                    clean_field = field[1:]
                new_user[clean_field] = ""
            
            new_user["id"] = str(user_id)
            new_user["CUser_ID"] = cuser_id
            new_user["name"] = f"{first_name} {last_name}".strip()
            new_user["first_name"] = first_name
            new_user["last_name"] = last_name
            new_user["conversations_count"] = "0"
            new_user["first_contact_at"] = str(int(time.time()))
            new_user["last_contact_at"] = str(int(time.time()))
            if username:
                new_user["Никнейм"] = f"@{username}"
            
            users.append(new_user)
            logger.info(f"Добавлен новый пользователь {user_id}, текущее количество: {len(users)}")
            
            # Записываем обновленные данные
            success = await write_users_csv(users)
            if not success:
                logger.error(f"Не удалось сохранить нового пользователя {user_id}")
            else:
                logger.info(f"Новый пользователь {user_id} успешно сохранен в CSV")
        
        # Возвращаем найденного или созданного пользователя
        for user in users:
            if user.get("id") == str(user_id):
                return user
        
        # Если по какой-то причине пользователь не найден после всех операций
        raise ValueError(f"Пользователь с ID {user_id} не найден после создания/обновления")
        
    except Exception as e:
        logger.error(f"Ошибка при работе с пользователем {user_id}: {e}")
        logger.exception("Подробная информация об ошибке:")
        raise

async def get_active_users():
    """Получение списка всех активных пользователей"""
    return await read_users_csv()

# Структура для хранения запланированных рассылок
scheduled_broadcasts = []

# Определение состояний для FSM
class BroadcastStates(StatesGroup):
    waiting_for_message = State()
    waiting_for_datetime = State()
    confirm_broadcast = State()

class NotificationRequest(BaseModel):
    user_id: int
    goods: dict
    quantity: int
    reservation_date: str

# Функция для загрузки сохраненных рассылок
def load_broadcasts():
    """Загрузка сохраненных рассылок из файла"""
    try:
        if os.path.exists(BROADCASTS_PATH):
            with open(BROADCASTS_PATH, 'r', encoding='utf-8') as f:
                broadcasts = json.load(f)
                
                # Преобразуем строковые даты в объекты datetime
                for broadcast in broadcasts:
                    if broadcast.get("scheduled_time"):
                        dt = datetime.fromisoformat(broadcast["scheduled_time"])
                        # Если у даты нет часового пояса, считаем её в МСК
                        if dt.tzinfo is None:
                            dt = MOSCOW_TZ.localize(dt)
                        broadcast["scheduled_time"] = dt
                    if broadcast.get("created_at"):
                        dt = datetime.fromisoformat(broadcast["created_at"])
                        if dt.tzinfo is None:
                            dt = MOSCOW_TZ.localize(dt)
                        broadcast["created_at"] = dt
                    if broadcast.get("started_at"):
                        dt = datetime.fromisoformat(broadcast["started_at"])
                        if dt.tzinfo is None:
                            dt = MOSCOW_TZ.localize(dt)
                        broadcast["started_at"] = dt
                    if broadcast.get("completed_at"):
                        dt = datetime.fromisoformat(broadcast["completed_at"])
                        if dt.tzinfo is None:
                            dt = MOSCOW_TZ.localize(dt)
                        broadcast["completed_at"] = dt
                
                return broadcasts
        return []
    except Exception as e:
        logger.error(f"Ошибка при загрузке рассылок: {e}")
        return []

# Функция для сохранения рассылок
def save_broadcasts():
    """Сохранение рассылок в файл"""
    try:
        # Создаем копию списка для сериализации
        broadcasts_to_save = []
        
        for broadcast in scheduled_broadcasts:
            # Создаем копию каждой рассылки
            broadcast_copy = broadcast.copy()
            
            # Преобразуем datetime объекты в строки
            if isinstance(broadcast_copy.get("scheduled_time"), datetime):
                broadcast_copy["scheduled_time"] = broadcast_copy["scheduled_time"].isoformat()
            if isinstance(broadcast_copy.get("created_at"), datetime):
                broadcast_copy["created_at"] = broadcast_copy["created_at"].isoformat()
            if isinstance(broadcast_copy.get("started_at"), datetime):
                broadcast_copy["started_at"] = broadcast_copy["started_at"].isoformat()
            if isinstance(broadcast_copy.get("completed_at"), datetime):
                broadcast_copy["completed_at"] = broadcast_copy["completed_at"].isoformat()
            
            broadcasts_to_save.append(broadcast_copy)
        
        with open(BROADCASTS_PATH, 'w', encoding='utf-8') as f:
            json.dump(broadcasts_to_save, f, ensure_ascii=False, indent=4)
            
        return True
    except Exception as e:
        logger.error(f"Ошибка при сохранении рассылок: {e}")
        return False

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    try:
        # Сохраняем/обновляем пользователя в БД
        user = await get_or_create_user(
            user_id=message.from_user.id,
            username=message.from_user.username,
            first_name=message.from_user.first_name,
            last_name=message.from_user.last_name or ""
        )
        
        logger.info(f"Пользователь {user['id']} начал диалог с ботом")
        
        await message.answer(
            "🛍️ Добро пожаловать в PerfumeBot!\n\n"
            "Этот бот поможет вам найти и забронировать товары с кэшбеком.\n"
            "Используйте кнопку ниже для перехода в каталог.",
            reply_markup=types.InlineKeyboardMarkup(
                inline_keyboard=[[
                    types.InlineKeyboardButton(
                        text="Открыть магазин 🛒",
                        web_app=types.WebAppInfo(url=TELEGRAM_WEBAPP_URL)
                    )
                ]]
            )
        )
    except Exception as e:
        logger.error(f"Ошибка при обработке команды /start: {e}")
        await message.answer("⚠️ Произошла ошибка при обработке запроса")

@dp.message(Command("shop"))
async def cmd_shop(message: types.Message):
    # Сохраняем ID пользователя
    await message.answer(
        "🛒 PerfumeBot\n\n"
        "Нажмите на кнопку ниже для просмотра товаров:",
        reply_markup=types.InlineKeyboardMarkup(
            inline_keyboard=[[
                types.InlineKeyboardButton(
                    text="Открыть каталог 📋",
                    web_app=types.WebAppInfo(url=TELEGRAM_WEBAPP_URL)
                )
            ]]
        )
    )

@dp.message(Command("admin"))
async def cmd_admin(message: types.Message):
    if str(message.from_user.id) not in SUPER_ADMIN_IDS:
        return await message.answer("Доступ запрещён!")
    
    # Используем фрагмент URL (hash) вместо query параметра
    webapp_admin_url = TELEGRAM_WEBAPP_URL.split('?')[0] + "#admin"
    
    # Сохраняем ID админа
    await message.answer(
        "Панель управления\n\n"
        "Выберите действие:",
        reply_markup=types.InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    types.InlineKeyboardButton(
                        text="Админка",
                        web_app=types.WebAppInfo(url=webapp_admin_url)
                    )
                ],
                [
                    types.InlineKeyboardButton(
                        text="Создать рассылку 📢",
                        callback_data="create_broadcast"
                    )
                ],
                [
                    types.InlineKeyboardButton(
                        text="Управление рассылками 📝",
                        callback_data="manage_broadcasts"
                    )
                ]
            ]
        )
    )

# Обработчик для кнопки создания рассылки
@dp.callback_query(F.data == "create_broadcast")
async def create_broadcast(callback: types.CallbackQuery, state: FSMContext):
    # Проверяем, что это админ
    if str(callback.from_user.id) not in SUPER_ADMIN_IDS:
        await callback.answer("Доступ запрещён!", show_alert=True)
        return
    
    await callback.answer()
    await callback.message.answer("Отправьте текст сообщения для рассылки:")
    await state.set_state(BroadcastStates.waiting_for_message)

# Обработчик для получения текста рассылки
@dp.message(BroadcastStates.waiting_for_message)
async def process_broadcast_message(message: types.Message, state: FSMContext):
    # Сохраняем текст рассылки
    await state.update_data(message_text=message.text or message.caption, 
                           has_photo=bool(message.photo))
    
    # Если сообщение содержит фото, сохраняем его file_id
    if message.photo:
        photo = message.photo[-1]  # Берем самую большую версию фото
        await state.update_data(photo_file_id=photo.file_id)
    
    # Просим указать дату и время рассылки
    await message.answer(
        "Укажите дату и время отправки в формате ДД.ММ.ГГГГ ЧЧ:ММ\n"
        "Например: 01.05.2024 12:30\n\n"
        "Или отправьте 'сейчас' для немедленной отправки."
    )
    await state.set_state(BroadcastStates.waiting_for_datetime)

# Обработчик для получения даты и времени рассылки
@dp.message(BroadcastStates.waiting_for_datetime)
async def process_broadcast_datetime(message: types.Message, state: FSMContext):
    text = message.text.strip().lower()
    
    # Получаем текущую дату
    now = datetime.now(MOSCOW_TZ)
    scheduled_time = now
    
    # Если указано конкретное время
    if text != "сейчас":
        try:
            # Парсим введенную дату и время
            scheduled_time = datetime.strptime(text, "%d.%m.%Y %H:%M")
            
            # Проверяем, что дата в будущем
            if scheduled_time <= now:
                await message.answer("Указанная дата уже прошла. Пожалуйста, укажите дату в будущем.")
                return
                
        except ValueError:
            await message.answer(
                "Неверный формат даты и времени. Пожалуйста, используйте формат ДД.ММ.ГГГГ ЧЧ:ММ\n"
                "Например: 01.05.2024 12:30\n\n"
                "Или отправьте 'сейчас' для немедленной отправки."
            )
            return
    
    # Обновляем данные состояния
    await state.update_data(scheduled_time=scheduled_time)
    
    # Получаем все данные для подтверждения
    data = await state.get_data()
    message_text = data.get("message_text", "")
    has_photo = data.get("has_photo", False)
    
    # Форматируем время для отображения
    time_str = "немедленно" if text == "сейчас" else scheduled_time.strftime("%d.%m.%Y %H:%M")
    
    # Предлагаем подтвердить рассылку
    confirm_text = (
        f"<b>Проверьте информацию о рассылке:</b>\n\n"
        f"<b>Текст сообщения:</b>\n{message_text}\n\n"
        f"<b>{'С изображением' if has_photo else 'Без изображения'}</b>\n\n"
        f"<b>Запланировано на:</b> {time_str}\n\n"
        f"<b>Получатели:</b> {len(await get_active_users())} пользователей\n\n"
        f"Подтвердите отправку:"
    )
    
    await message.answer(
        confirm_text,
        parse_mode=ParseMode.HTML,
        reply_markup=types.InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    types.InlineKeyboardButton(text="✅ Подтвердить", callback_data="confirm_broadcast"),
                    types.InlineKeyboardButton(text="❌ Отменить", callback_data="cancel_broadcast")
                ]
            ]
        )
    )
    
    await state.set_state(BroadcastStates.confirm_broadcast)

# Обработчик подтверждения рассылки
@dp.callback_query(F.data == "confirm_broadcast", BroadcastStates.confirm_broadcast)
async def confirm_broadcast_handler(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    
    data = await state.get_data()
    message_text = data.get("message_text", "")
    photo_file_id = data.get("photo_file_id", None)
    scheduled_time = data.get("scheduled_time", datetime.now(MOSCOW_TZ))
    
    # Создаем объект рассылки
    broadcast_id = len(scheduled_broadcasts) + 1
    broadcast = {
        "id": broadcast_id,
        "message_text": message_text,
        "photo_file_id": photo_file_id,
        "scheduled_time": scheduled_time,
        "created_by": callback.from_user.id,
        "status": "scheduled",
        "created_at": datetime.now(MOSCOW_TZ)
    }
    
    # Добавляем рассылку в список
    scheduled_broadcasts.append(broadcast)
    
    # Сохраняем рассылки
    save_broadcasts()
    
    # Если рассылка запланирована на "сейчас", запускаем ее немедленно
    if scheduled_time <= datetime.now(MOSCOW_TZ) + timedelta(minutes=1):
        asyncio.create_task(send_broadcast(broadcast_id))
        await callback.message.edit_text(
            "✅ Рассылка запущена!\n\n"
            f"Текст сообщения:\n{message_text}\n\n"
            f"Получатели: {len(await get_active_users())} пользователей"
        )
    else:
        await callback.message.edit_text(
            "✅ Рассылка запланирована!\n\n"
            f"Текст сообщения:\n{message_text}\n\n"
            f"Запланировано на: {scheduled_time.strftime('%d.%m.%Y %H:%M')}\n"
            f"Получатели: {len(await get_active_users())} пользователей"
        )
    
    # Сбрасываем состояние
    await state.clear()

# Обработчик отмены рассылки
@dp.callback_query(F.data == "cancel_broadcast")
async def cancel_broadcast_handler(callback: types.CallbackQuery, state: FSMContext):
    await callback.answer()
    await callback.message.edit_text("❌ Создание рассылки отменено.")
    await state.clear()

# Функция для отправки рассылки
async def send_broadcast(broadcast_id: int):
    """Отправка сообщения всем пользователям"""
    broadcast = next((b for b in scheduled_broadcasts if b["id"] == broadcast_id), None)
    if not broadcast:
        logger.error(f"Рассылка с ID {broadcast_id} не найдена")
        return
    
    # Обновляем статус
    broadcast["status"] = "in_progress"
    broadcast["started_at"] = datetime.now(MOSCOW_TZ)
    
    # Получаем всех активных пользователей
    users = await get_active_users()
    
    # Статистика
    successful_sends = 0
    failed_sends = 0
    blocked_users = 0
    
    # Отправляем сообщение каждому пользователю
    for user in users:
        try:
            user_id = int(user["id"])
            
            # Пропускаем неактивных пользователей (можно добавить логику)
            
            # Отправляем сообщение
            if broadcast["photo_file_id"]:
                await bot.send_photo(
                    chat_id=user_id,
                    photo=broadcast["photo_file_id"],
                    caption=broadcast["message_text"],
                    parse_mode=ParseMode.HTML
                )
            else:
                await bot.send_message(
                    chat_id=user_id,
                    text=broadcast["message_text"],
                    parse_mode=ParseMode.HTML
                )
            
            successful_sends += 1
            
            # Небольшая задержка между отправками, чтобы избежать ограничений Telegram
            await asyncio.sleep(0.05)
            
        except TelegramForbiddenError:
            # Пользователь заблокировал бота
            blocked_users += 1
            logger.warning(f"Пользователь {user_id} заблокировал бота")
            
        except Exception as e:
            failed_sends += 1
            logger.error(f"Ошибка отправки рассылки пользователю {user['id']}: {e}")
    
    # Обновляем статус и статистику
    broadcast["status"] = "completed"
    broadcast["completed_at"] = datetime.now(MOSCOW_TZ)
    broadcast["total_recipients"] = len(users)
    broadcast["successful_sends"] = successful_sends
    broadcast["failed_sends"] = failed_sends
    broadcast["blocked_users"] = blocked_users
    
    # Сохраняем обновленные данные
    save_broadcasts()
    
    logger.info(f"Рассылка {broadcast_id} завершена. Успешно: {successful_sends}, Ошибки: {failed_sends}, Блокировки: {blocked_users}")

async def update_user_block_status(user_id: int, is_blocked: bool):
    # Реализация функции для обновления статуса блокировки пользователя в CSV файле
    pass

# Обработчик для кнопки управления рассылками
@dp.callback_query(F.data == "manage_broadcasts")
async def manage_broadcasts_handler(callback: types.CallbackQuery):
    if str(callback.from_user.id) not in SUPER_ADMIN_IDS:
        await callback.answer("Доступ запрещён!", show_alert=True)
        return
    
    await callback.answer()
    
    # Если нет рассылок
    if not scheduled_broadcasts:
        await callback.message.edit_text(
            "📝 Управление рассылками\n\n"
            "У вас нет запланированных рассылок.",
            reply_markup=types.InlineKeyboardMarkup(
                inline_keyboard=[
                    [types.InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_admin")]
                ]
            )
        )
        return
    
    # Формируем список запланированных рассылок
    now = datetime.now(MOSCOW_TZ)
    active_broadcasts = [b for b in scheduled_broadcasts 
                         if b["status"] == "scheduled" and b["scheduled_time"] > now]
    
    # Сортируем по времени отправки
    active_broadcasts.sort(key=lambda b: b["scheduled_time"])
    
    # Создаем текст сообщения
    text = "📝 Управление рассылками\n\n"
    
    if active_broadcasts:
        text += "<b>Запланированные рассылки:</b>\n\n"
        for broadcast in active_broadcasts[:5]:  # Показываем максимум 5 рассылок
            scheduled_time = broadcast["scheduled_time"].strftime("%d.%m.%Y %H:%M")
            message_preview = broadcast["message_text"][:50] + "..." if len(broadcast["message_text"]) > 50 else broadcast["message_text"]
            
            text += (
                f"<b>ID: {broadcast['id']}</b>\n"
                f"<b>Время:</b> {scheduled_time}\n"
                f"<b>Текст:</b> {message_preview}\n\n"
            )
        
        if len(active_broadcasts) > 5:
            text += f"И еще {len(active_broadcasts) - 5} запланированных рассылок.\n\n"
    else:
        text += "У вас нет активных запланированных рассылок.\n\n"
    
    # Недавно выполненные рассылки
    completed_broadcasts = [b for b in scheduled_broadcasts if b["status"] == "completed" and b["completed_at"] > now - timedelta(days=1)]
    completed_broadcasts.sort(key=lambda b: b.get("completed_at", datetime.now(MOSCOW_TZ)), reverse=True)
    
    if completed_broadcasts:
        text += "<b>Последние выполненные рассылки:</b>\n\n"
        for broadcast in completed_broadcasts[:3]:  # Показываем максимум 3 рассылки
            completed_at = broadcast.get("completed_at", now).strftime("%d.%m.%Y %H:%M")
            stats = broadcast.get("stats", {})
            
            text += (
                f"<b>ID: {broadcast['id']}</b>\n"
                f"<b>Выполнено:</b> {completed_at}\n"
                f"<b>Статистика:</b> {stats.get('success', 0)}/{stats.get('total', 0)} доставлено\n\n"
            )
    
    # Создаем клавиатуру для управления
    keyboard = []
    
    if active_broadcasts:
        keyboard.append([
            types.InlineKeyboardButton(
                text="🗑️ Отменить рассылку",
                callback_data="cancel_scheduled_broadcast"
            )
        ])
    
    keyboard.append([
        types.InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_admin")
    ])
    
    await callback.message.edit_text(
        text,
        parse_mode=ParseMode.HTML,
        reply_markup=types.InlineKeyboardMarkup(inline_keyboard=keyboard)
    )

# Обработчик кнопки отмены запланированной рассылки
@dp.callback_query(F.data == "cancel_scheduled_broadcast")
async def cancel_scheduled_broadcast_handler(callback: types.CallbackQuery):
    if str(callback.from_user.id) not in SUPER_ADMIN_IDS:
        await callback.answer("Доступ запрещён!", show_alert=True)
        return
    
    await callback.answer()
    
    # Получаем активные рассылки
    now = datetime.now(MOSCOW_TZ)
    active_broadcasts = [b for b in scheduled_broadcasts 
                        if b["status"] == "scheduled" and b["scheduled_time"] > now]
    
    if not active_broadcasts:
        await callback.message.edit_text(
            "У вас нет активных запланированных рассылок.",
            reply_markup=types.InlineKeyboardMarkup(
                inline_keyboard=[
                    [types.InlineKeyboardButton(text="◀️ Назад", callback_data="manage_broadcasts")]
                ]
            )
        )
        return
    
    # Создаем инлайн клавиатуру для выбора рассылки для отмены
    keyboard = []
    for broadcast in active_broadcasts[:10]:  # Ограничиваем 10 кнопками
        scheduled_time = broadcast["scheduled_time"].strftime("%d.%m.%Y %H:%M")
        keyboard.append([
            types.InlineKeyboardButton(
                text=f"ID {broadcast['id']} - {scheduled_time}",
                callback_data=f"delete_broadcast_{broadcast['id']}"
            )
        ])
    
    keyboard.append([
        types.InlineKeyboardButton(text="◀️ Назад", callback_data="manage_broadcasts")
    ])
    
    await callback.message.edit_text(
        "Выберите рассылку для отмены:",
        reply_markup=types.InlineKeyboardMarkup(inline_keyboard=keyboard)
    )

# Обработчик выбора рассылки для отмены
@dp.callback_query(F.data.startswith("delete_broadcast_"))
async def delete_broadcast_handler(callback: types.CallbackQuery):
    if str(callback.from_user.id) not in SUPER_ADMIN_IDS:
        await callback.answer("Доступ запрещён!", show_alert=True)
        return
    
    # Извлекаем ID рассылки
    broadcast_id = int(callback.data.split("_")[-1])
    
    # Ищем рассылку в списке
    broadcast_index = next((i for i, b in enumerate(scheduled_broadcasts) 
                            if b["id"] == broadcast_id and b["status"] == "scheduled"), None)
    
    if broadcast_index is not None:
        # Обновляем статус рассылки
        scheduled_broadcasts[broadcast_index]["status"] = "cancelled"
        save_broadcasts()
        
        await callback.answer("Рассылка отменена!")
        
        # Возвращаемся к управлению рассылками
        await manage_broadcasts_handler(callback)
    else:
        await callback.answer("Рассылка не найдена или уже выполнена.", show_alert=True)
        await manage_broadcasts_handler(callback)

# Обработчик кнопки "Назад" в меню рассылок
@dp.callback_query(F.data == "back_to_admin")
async def back_to_admin_handler(callback: types.CallbackQuery):
    await callback.answer()
    
    # Используем фрагмент URL (hash) вместо query параметра
    webapp_admin_url = TELEGRAM_WEBAPP_URL.split('?')[0] + "#admin"
    
    # Воссоздаем меню администратора
    keyboard = [
        [
            types.InlineKeyboardButton(
                text="Админка",
                web_app=types.WebAppInfo(url=webapp_admin_url)
            )
        ],
        [
            types.InlineKeyboardButton(
                text="Создать рассылку 📢",
                callback_data="create_broadcast"
            )
        ],
        [
            types.InlineKeyboardButton(
                text="Управление рассылками 📝",
                callback_data="manage_broadcasts"
            )
        ]
    ]
    
    await callback.message.edit_text(
        "Панель управления\n\n"
        "Выберите действие:",
        reply_markup=types.InlineKeyboardMarkup(inline_keyboard=keyboard)
    )

# Обработчик запросов от бэкенда о бронировании товаров
@app.post("/send_notification")
async def send_reservation_notification(request: Request):
    data = await request.json()
    user_id = data.get("user_id")
    goods_data = data.get("goods_data", {})
    quantity = data.get("quantity", 1)
    
    if not user_id or not goods_data:
        logger.error(f"Недостаточно данных для отправки уведомления: user_id={user_id}, goods_data={bool(goods_data)}")
        return {"status": "error", "message": "Недостаточно данных"}
    
    goods_name = goods_data.get("name", "")
    goods_article = goods_data.get("article", "")
    # Получаем только последние 4 цифры артикула
    masked_article = '*' * (len(goods_article) - 4) + goods_article[-4:] if len(goods_article) >= 4 else goods_article
    goods_price = goods_data.get("price", 0)
    goods_cashback_percent = goods_data.get("cashback_percent", 0)
    goods_price_with_cashback = goods_price * (1 - goods_cashback_percent / 100)
    goods_image = goods_data.get("image", "")
    purchase_guide = goods_data.get("purchase_guide", "")
    
    # Формируем сообщение для пользователя
    message_text = (
        f"<b>🛍️ Товар забронирован!</b>\n\n"
        f"<b>Название:</b> {goods_name}\n"
        f"<b>Артикул:</b> {masked_article}\n"
        f"<b>Количество:</b> {quantity} шт.\n"
        f"<b>Цена:</b> <s>{goods_price} ₽</s>\n"
        f"<b>Цена с кэшбеком {goods_cashback_percent}%:</b> {round(goods_price_with_cashback)} ₽\n\n"
    )
    
    # Добавляем инструкцию по покупке, если она есть
    if purchase_guide:
        message_text += f"<b>Инструкция по покупке:</b>\n{purchase_guide}"
    else:
        message_text += "Для получения инструкции по покупке, пожалуйста, свяжитесь с администратором.\n\n"
    
    message_text += "\n\nБлагодарим за использование нашего сервиса! 🙏"
    
    try:
        logger.info(f"Отправка уведомления о бронировании пользователю {user_id}")
        
        # Сначала отправляем изображение товара, если оно есть
        if goods_image:
            await bot.send_photo(
                chat_id=user_id,
                photo=goods_image,
                caption=message_text,
                parse_mode=ParseMode.HTML
            )
        else:
            # Если изображения нет, просто отправляем текст
            await bot.send_message(
                chat_id=user_id,
                text=message_text,
                parse_mode=ParseMode.HTML
            )
        logger.info(f"Уведомление успешно отправлено пользователю {user_id}")
        return {"status": "success"}
    except TelegramForbiddenError:
        # Пользователь заблокировал бота
        error_msg = f"Пользователь {user_id} заблокировал бота"
        logger.warning(error_msg)
        return {"status": "error", "message": error_msg}
    except TelegramBadRequest as e:
        # Неверный запрос к API Telegram
        error_msg = f"Ошибка при отправке сообщения пользователю {user_id}: {str(e)}"
        logger.error(error_msg)
        return {"status": "error", "message": error_msg}
    except TelegramAPIError as e:
        # Общая ошибка API Telegram
        error_msg = f"Ошибка API Telegram при отправке сообщения пользователю {user_id}: {str(e)}"
        logger.error(error_msg)
        return {"status": "error", "message": error_msg}
    except Exception as e:
        # Неожиданная ошибка
        error_msg = f"Непредвиденная ошибка при отправке сообщения пользователю {user_id}: {str(e)}"
        logger.error(error_msg)
        return {"status": "error", "message": error_msg}

@app.post("/notify")
async def handle_notification(request: NotificationRequest):
    try:
        logger.info(f"Получен запрос на отправку уведомления пользователю {request.user_id}")
        
        # Расчет цены с кэшбеком
        price = request.goods['price']
        cashback_percent = request.goods.get('cashback_percent', 0)
        price_with_cashback = price * (1 - cashback_percent / 100)
        masked_article = '*' * (len(request.goods['article']) - 4) + request.goods['article'][-4:] if len(request.goods['article']) >= 4 else request.goods['article']
        
        message = (
            "🎉 Новое бронирование!\n\n"
            f"Товар: {request.goods['name']}\n"
            f"Артикул: {masked_article}\n"
            f"Количество: {request.quantity}\n"
            f"Цена: <s>{price} ₽</s>\n"
            f"Цена с кэшбеком {cashback_percent}%: {round(price_with_cashback)} ₽\n"
            f"Дата: {request.reservation_date}"
        )
        
        await bot.send_message(
            chat_id=request.user_id,
            text=message,
            parse_mode=ParseMode.HTML
        )
        logger.info(f"Уведомление успешно отправлено пользователю {request.user_id}")
        return {"status": "success"}
    except TelegramForbiddenError:
        error_msg = f"Пользователь {request.user_id} заблокировал бота"
        logger.warning(error_msg)
        raise HTTPException(status_code=403, detail=error_msg)
    except Exception as e:
        error_msg = f"Ошибка при отправке уведомления пользователю {request.user_id}: {str(e)}"
        logger.error(error_msg)
        raise HTTPException(status_code=500, detail=error_msg)

# Планировщик для проверки и отправки запланированных рассылок
async def check_scheduled_broadcasts():
    """Проверка и отправка запланированных рассылок"""
    try:
        now = datetime.now(MOSCOW_TZ)
        
        for broadcast in scheduled_broadcasts:
            # Проверяем только запланированные рассылки
            if broadcast['status'] != 'scheduled':
                continue
            
            # Проверяем, наступило ли время для отправки
            scheduled_time = broadcast['scheduled_time']
            
            # Если у scheduled_time нет информации о часовом поясе, считаем его московским
            if scheduled_time.tzinfo is None:
                scheduled_time = MOSCOW_TZ.localize(scheduled_time)
            
            if scheduled_time <= now:
                logger.info(f"Начинаем отправку рассылки ID {broadcast['id']}")
                broadcast['status'] = 'in_progress'
                broadcast['started_at'] = now
                save_broadcasts()
                
                # Запускаем отправку рассылки
                asyncio.create_task(send_broadcast(broadcast['id']))
    except Exception as e:
        logger.error(f"Ошибка при проверке запланированных рассылок: {e}")

async def main():
    # Загружаем сохраненные рассылки
    global scheduled_broadcasts
    scheduled_broadcasts = load_broadcasts()
    
    # Запускаем планировщик рассылок
    asyncio.create_task(check_scheduled_broadcasts())
    
    # Запускаем бота и FastAPI сервер параллельно через uvicorn
    from uvicorn import Server
    from uvicorn.config import Config
    
    # Конфигурация сервера
    server = Server(
        Config(
            app=app,
            host="0.0.0.0",
            port=8080,
            loop="asyncio",
            log_level="info"
        )
    )
    
    # Создаем и запускаем задачи
    bot_task = asyncio.create_task(dp.start_polling(bot))
    server_task = asyncio.create_task(server.serve())
    
    await asyncio.gather(bot_task, server_task)

async def get_user_reservations(user_id: int) -> List[dict]:
    logger.info(f"Запрашиваем бронирования для пользователя {user_id}")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_API_URL}/user/{user_id}/reservations/") as response:
                if response.status == 200:
                    reservations = await response.json()
                    logger.info(f"Получено {len(reservations)} бронирований для пользователя {user_id}")
                    logger.debug(f"Данные бронирований: {reservations}")  # Для отладки
                    return reservations
                else:
                    logger.error(f"Ошибка при получении бронирований: {response.status}")
                    return []
    except Exception as e:
        logger.error(f"Исключение при получении бронирований: {e}", exc_info=True)
        return []

@dp.message(Command("reservations"))
async def cmd_reservations(message: types.Message):
    try:
        # Получаем список бронирований через API
        reservations = await get_user_reservations(message.from_user.id)
        
        if not reservations:
            await message.answer("🚫 У вас нет активных бронирований")
            return
        
        # Формируем сообщение с кнопками
        keyboard = []
        for res in reservations:
            # Форматируем дату
            reserved_date = datetime.fromisoformat(res['reserved_at'].replace('Z', '+00:00'))
            formatted_date = reserved_date.strftime('%d.%m.%Y')
            
            btn_text = f"{res['goods_name']} ({res['quantity']} шт.) - {formatted_date}"
            keyboard.append([
                types.InlineKeyboardButton(
                    text=btn_text,
                    callback_data=f"reservation_detail_{res['id']}"
                )
            ])
        
        # Добавляем кнопку закрытия
        keyboard.append([
            types.InlineKeyboardButton(
                text="❌ Закрыть",
                callback_data="close_reservations"
            )
        ])
        
        await message.answer(
            "📋 Ваши активные бронирования:\n\n"
            "Нажмите на бронирование для управления:",
            reply_markup=types.InlineKeyboardMarkup(inline_keyboard=keyboard)
        )
        
    except Exception as e:
        logger.error(f"Ошибка при получении бронирований: {e}")
        await message.answer("⚠️ Произошла ошибка при загрузке бронирований")

@dp.callback_query(F.data.startswith("reservation_detail_"))
async def reservation_detail_handler(callback: types.CallbackQuery):
    reservation_id = callback.data.split("_")[-1]
    
    try:
        # Получаем все бронирования пользователя
        reservations = await get_user_reservations(callback.from_user.id)
        
        # Находим нужное бронирование по ID
        reservation = next((r for r in reservations if str(r['id']) == reservation_id), None)
        
        if not reservation:
            await callback.answer("Бронирование не найдено", show_alert=True)
            return
        
        # Безопасное получение данных с значениями по умолчанию
        goods_name = reservation.get('goods_name', 'Название не указано')
        goods_article = reservation.get('goods_article', 'Артикул не указан')
        quantity = reservation.get('quantity', 0)
        price = reservation.get('goods_price', 0)
        cashback_percent = reservation.get('goods_cashback_percent', 0)
        reserved_at = reservation.get('reserved_at', '')

        # Безопасное форматирование даты
        try:
            reserved_date = datetime.fromisoformat(reserved_at.replace('Z', '+00:00'))
            formatted_date = reserved_date.strftime('%d.%m.%Y %H:%M')
        except (ValueError, AttributeError):
            formatted_date = 'Дата не указана'
        
        # Рассчитываем цену с кэшбеком
        price_with_cashback = price * (1 - cashback_percent / 100)
        
        # Безопасное маскирование артикула
        if goods_article and len(goods_article) >= 4:
            masked_article = '*' * (len(goods_article) - 4) + goods_article[-4:]
        else:
            masked_article = goods_article

        # Формируем клавиатуру
        keyboard = [
            [
                types.InlineKeyboardButton(
                    text="❌ Отменить бронирование",
                    callback_data=f"cancel_reservation_{reservation_id}"
                )
            ],
            [
                types.InlineKeyboardButton(
                    text="🔙 Назад",
                    callback_data="back_to_reservations"
                )
            ]
        ]
        
        # Формируем текст сообщения с проверкой наличия данных
        message_text = [
            f"📦 Бронирование №{reservation_id}",
            "",
            f"Товар: {goods_name}"
        ]
        
        if goods_article != 'Артикул не указан':
            message_text.append(f"Артикул: {masked_article}")
        
        message_text.extend([
            f"Количество: {quantity} шт.",
            f"Цена: <s>{price} ₽</s>",
            f"Цена с кэшбеком {cashback_percent}%: {round(price_with_cashback)} ₽",
            f"Дата: {formatted_date}",
            "",
            "Выберите действие:"
        ])
        
        await callback.message.edit_text(
            "\n".join(message_text),
            reply_markup=types.InlineKeyboardMarkup(inline_keyboard=keyboard),
            parse_mode=ParseMode.HTML
        )
        
    except Exception as e:
        logger.error(f"Ошибка при получении бронирования: {e}", exc_info=True)
        await callback.answer("⚠️ Не удалось загрузить данные", show_alert=True)

@dp.callback_query(F.data.startswith("cancel_reservation_"))
async def cancel_reservation_handler(callback: types.CallbackQuery):
    reservation_id = callback.data.split("_")[-1]
    user_id = callback.from_user.id
    
    try:
        # Более простой запрос - ID пользователя прямо в URL
        async with aiohttp.ClientSession() as session:
            async with session.delete(
                f"{BACKEND_API_URL}/reservations/{reservation_id}/user/{user_id}"
            ) as response:
                if response.status != 204:
                    error_text = await response.text()
                    logger.error(f"Ошибка при отмене бронирования: {response.status}, {error_text}")
                    await callback.answer("⚠️ Не удалось отменить бронирование", show_alert=True)
                    return
                
                # Успешная отмена
                await callback.answer("✅ Бронирование успешно отменено!")
                
                # Обновляем список бронирований
                await cmd_reservations(callback.message)
                
    except Exception as e:
        logger.error(f"Ошибка при отмене бронирования: {e}")
        await callback.answer("⚠️ Не удалось отменить бронирование", show_alert=True)

@dp.callback_query(F.data == "back_to_reservations")
async def back_to_reservations_handler(callback: types.CallbackQuery):
    await callback.answer()
    await cmd_reservations(callback.message)

@dp.callback_query(F.data == "close_reservations")
async def close_reservations_handler(callback: types.CallbackQuery):
    await callback.answer()
    await callback.message.delete()
    
@dp.message(Command("help"))
async def help_command(message: types.Message):
    await message.answer("""
    /start - Начало работы
    /reservations - Список бронирований
    /categories - Список категорий
    """)
if __name__ == "__main__":
    import asyncio
    asyncio.run(main()) 