import os
import asyncio
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.enums import ParseMode
from fastapi import FastAPI, Request, HTTPException
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Создаем FastAPI приложение для обработки запросов от бэкенда
app = FastAPI()

# Настройка CORS для API бота
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Только нефритовый лидер имеет доступ
SUPER_ADMIN_IDS=os.getenv("SUPER_ADMIN_IDS")

bot = Bot(token=os.getenv("TELEGRAM_BOT_TOKEN"))
dp = Dispatcher()

WEBAPP_URL = os.getenv("WEBAPP_URL") + "?startapp=1"  # Добавляем параметр для инициализации

# Сохраняем ID пользователей, которые начали диалог с ботом
users_started = set()

class NotificationRequest(BaseModel):
    user_id: int
    goods: dict
    quantity: int
    reservation_date: str

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    # Сохраняем ID пользователя
    users_started.add(message.from_user.id)
    
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
    if str(message.from_user.id) not in SUPER_ADMIN_IDS:
        return await message.answer("Доступ запрещён! 🚫 Только Великий Лидер!")
    
    # Сохраняем ID админа
    users_started.add(message.from_user.id)
    
    await message.answer(
        "Панель управления КПК\n\n"
        "Откройте админку через кнопку ниже:",
        reply_markup=types.InlineKeyboardMarkup(
            inline_keyboard=[[
                types.InlineKeyboardButton(
                    text="Админка КПК 🇨🇳",
                    web_app=types.WebAppInfo(url=WEBAPP_URL)
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
        return {"status": "error", "message": "Недостаточно данных"}
    
    goods_name = goods_data.get("name", "")
    goods_article = goods_data.get("article", "")
    goods_price = goods_data.get("price", 0)
    goods_image = goods_data.get("image", "")
    purchase_guide = goods_data.get("purchase_guide", "")
    
    # Проверяем, начал ли пользователь диалог с ботом
    if int(user_id) not in users_started:
        print(f"Пользователь {user_id} не инициализировал бота. Отправляем общее сообщение.")
        return {"status": "error", "message": "Пользователь не инициализировал бота"}
    
    # Формируем сообщение для пользователя
    message_text = (
        f"🎉 Бронирование успешно!\n\n"
        f"Товар: {goods_name}\n"
        f"Артикул: {goods_article}\n"
        f"Цена: {goods_price} ₽\n"
        f"Количество: {quantity}\n\n"
    )
    
    # Добавляем инструкцию по покупке, если она есть
    if purchase_guide:
        message_text += f"📋 <b>Инструкция по покупке:</b>\n{purchase_guide}\n\n"
    else:
        message_text += "Для получения инструкции по покупке, пожалуйста, свяжитесь с администратором.\n\n"
    
    message_text += "Благодарим за использование нашего сервиса! 🙏"
    
    try:
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
        return {"status": "success"}
    except Exception as e:
        print(f"Ошибка при отправке сообщения: {str(e)}")
        return {"status": "error", "message": str(e)}

@app.post("/notify")
async def handle_notification(request: NotificationRequest):
    try:
        message = (
            "🎉 Новое бронирование!\n\n"
            f"Товар: {request.goods['name']}\n"
            f"Артикул: {request.goods['article']}\n"
            f"Количество: {request.quantity}\n"
            f"Дата: {request.reservation_date}"
        )
        
        await bot.send_message(
            chat_id=request.user_id,
            text=message,
            parse_mode=types.ParseMode.HTML
        )
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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