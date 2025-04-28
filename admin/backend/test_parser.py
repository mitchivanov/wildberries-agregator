#!/usr/bin/env python
"""
Тестовый скрипт для проверки логирования функции парсера Wildberries.
Запускать в контейнере: docker exec -it wildberries-agregator-backend-1 python test_parser.py
"""

import logging
import sys
import asyncio
from parser import parse_wildberries_url

# Настройка логирования
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    stream=sys.stdout,
    force=True
)
logger = logging.getLogger("test_parser")

async def test_parser():
    logger.debug("Тест парсера начат (DEBUG)")
    logger.info("Тест парсера начат (INFO)")
    
    # Тестовый URL Wildberries
    test_url = "https://www.wildberries.ru/catalog/391190323/detail.aspx?targetUrl=SP"
    logger.debug(f"Тестирование URL: {test_url}")
    
    try:
        result = await parse_wildberries_url(test_url)
        
        if result:
            logger.debug("Успешный результат парсинга (DEBUG):")
            logger.info("Успешный результат парсинга (INFO):")
            for key, value in result.items():
                logger.debug(f"{key}: {value}")
                logger.info(f"{key}: {value}")
        else:
            logger.error("Ошибка при парсинге тестового URL - результат None")
    except Exception as e:
        logger.exception(f"Исключение при тестировании парсера: {e}")

if __name__ == "__main__":
    print("Запуск теста парсера Wildberries...")
    asyncio.run(test_parser())
    print("Тест завершен.") 