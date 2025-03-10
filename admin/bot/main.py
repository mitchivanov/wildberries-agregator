import os
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.enums import ParseMode

# Только нефритовый лидер имеет доступ
SUPER_ADMIN_ID = 5304440647

bot = Bot(token=os.getenv("BOT_TOKEN"))
dp = Dispatcher()

WEBAPP_URL = os.getenv("WEBAPP_URL") + "?startapp=1"  # Добавляем параметр для инициализации

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    if str(message.from_user.id) != str(SUPER_ADMIN_ID):
        return await message.answer("Доступ запрещён! 🚫 Только Великий Лидер!")
    
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

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main()) 