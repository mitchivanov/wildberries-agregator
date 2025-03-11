import os
import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramAPIError, TelegramBadRequest, TelegramForbiddenError
from fastapi import FastAPI, Request, HTTPException
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
    allow_origins=["https://develooper.ru"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Только нефритовый лидер имеет доступ
SUPER_ADMIN_IDS = os.getenv("SUPER_ADMIN_IDS")

bot = Bot(token=os.getenv("TELEGRAM_BOT_TOKEN"))
dp = Dispatcher()

WEBAPP_URL = os.getenv("WEBAPP_URL") + "?startapp=1"  # Добавляем параметр для инициализации

# Сохраняем ID пользователей, которые начали диалог с ботом
# Эта переменная используется только для отслеживания статистики, но не для ограничения отправки сообщений
users_started = set()

class NotificationRequest(BaseModel):
    user_id: int
    goods: dict
    quantity: int
    reservation_date: str

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    # Сохраняем ID пользователя для статистики
    users_started.add(message.from_user.id)
    logger.info(f"Пользователь {message.from_user.id} начал диалог с ботом")
    
    await message.answer(
        "🛍️ Добро пожаловать в Wild Berries Assistant!\n\n"
        "Этот бот поможет вам найти и забронировать товары.\n"
        "Используйте команду /shop для перехода в каталог.",
        reply_markup=types.InlineKeyboardMarkup(
            inline_keyboard=[[
                types.InlineKeyboardButton(
                    text="Открыть магазин 🛒",
                    web_app=types.WebAppInfo(url=WEBAPP_URL)
                )
            ]]
        )
    )

@dp.message(Command("shop"))
async def cmd_shop(message: types.Message):
    # Сохраняем ID пользователя
    users_started.add(message.from_user.id)
    
    await message.answer(
        "🛒 Магазин Wild Berries\n\n"
        "Нажмите на кнопку ниже для просмотра товаров:",
        reply_markup=types.InlineKeyboardMarkup(
            inline_keyboard=[[
                types.InlineKeyboardButton(
                    text="Открыть каталог 📋",
                    web_app=types.WebAppInfo(url=WEBAPP_URL)
                )
            ]]
        )
    )

@dp.message(Command("admin"))
async def cmd_admin(message: types.Message):
    if str(message.from_user.id) not in SUPER_ADMIN_IDS.split(","):
        return await message.answer("Доступ запрещён!")
    
    # Сохраняем ID админа
    users_started.add(message.from_user.id)
    
    await message.answer(
        "Панель управления КПК\n\n"
        "Откройте админку через кнопку ниже:",
        reply_markup=types.InlineKeyboardMarkup(
            inline_keyboard=[[
                types.InlineKeyboardButton(
                    text="Админка КПК 🇨🇳",
                    web_app=types.WebAppInfo(url=f"{WEBAPP_URL}/admin")
                )
            ]]
        )
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
    goods_price = goods_data.get("price", 0)
    goods_cashback_percent = goods_data.get("cashback_percent", 0)
    goods_price_with_cashback = goods_price * (1 - goods_cashback_percent / 100)
    goods_image = goods_data.get("image", "")
    purchase_guide = goods_data.get("purchase_guide", "")
    
    # Убираем проверку на наличие пользователя в users_started
    # Вместо этого добавляем детальное логирование и обработку ошибок
    
    # Формируем сообщение для пользователя
    message_text = (
        f"<b>🛍️ Товар забронирован!</b>\n\n"
        f"<b>Название:</b> {goods_name}\n"
        f"<b>Артикул:</b> {goods_article}\n"
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
        
        message = (
            "🎉 Новое бронирование!\n\n"
            f"Товар: {request.goods['name']}\n"
            f"Артикул: {request.goods['article']}\n"
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

async def main():
    # Запускаем бота и FastAPI сервер параллельно через uvicorn
    import uvicorn
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

if __name__ == "__main__":
    import asyncio
    asyncio.run(main()) 