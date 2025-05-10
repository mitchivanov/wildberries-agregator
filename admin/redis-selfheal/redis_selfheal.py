import time
import logging
import os
import subprocess
import redis

logging.basicConfig(
    filename="/logs/redis_selfheal.log",
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s"
)

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))
CHECK_INTERVAL = int(os.environ.get("CHECK_INTERVAL", 60))
PROMOTION_RETRIES = int(os.environ.get("PROMOTION_RETRIES", 3))


def is_redis_master():
    try:
        r = redis.StrictRedis(host=REDIS_HOST, port=REDIS_PORT, socket_connect_timeout=5)
        info = r.info("replication")
        role = info.get("role", "unknown")
        logging.info(f"Redis role: {role}")
        return role == "master"
    except Exception as e:
        logging.error(f"Failed to check Redis role: {e}")
        return False

def restart_redis():
    # Сперва пробуем корректно завершить Redis — Docker перезапустит контейнер сам.
    try:
        r = redis.StrictRedis(host=REDIS_HOST, port=REDIS_PORT, socket_connect_timeout=5)
        logging.warning("Issuing SHUTDOWN NOSAVE to Redis...")
        r.execute_command("SHUTDOWN", "NOSAVE")
    except redis.exceptions.ConnectionError:
        # Соединение оборвётся, это ожидаемо
        logging.info("Redis shutdown command sent, waiting for container restart...")
        time.sleep(5)
        return
    except Exception as e:
        logging.error(f"Graceful shutdown failed: {e}")

    # Если не получилось, пробуем через docker (если CLI установлен)
    try:
        logging.warning("Attempting to restart redis container via docker CLI...")
        subprocess.run(["docker", "restart", "$(hostname)"], shell=True, check=True)
        logging.info("Docker restart command executed.")
    except Exception as e:
        logging.error(f"Failed to restart redis via docker CLI: {e}")

def promote_to_master() -> bool:
    """Попытаться перевести текущий экземпляр Redis в режим master без перезапуска.
    Возвращает True, если удалось, иначе False."""
    try:
        r = redis.StrictRedis(host=REDIS_HOST, port=REDIS_PORT, socket_connect_timeout=5)
        response = r.execute_command("REPLICAOF", "NO", "ONE")  # начиная с redis 5 SLAVEOF = REPLICAOF
        logging.warning(f"Executed REPLICAOF NO ONE, response: {response}")
        # Дадим Redis немного времени на переключение роли
        time.sleep(2)
        return is_redis_master()
    except Exception as e:
        logging.error(f"Failed to promote Redis to master: {e}")
        return False

def main():
    while True:
        if not is_redis_master():
            logging.error("Redis is not master! Attempting promotion...")
            promoted = False
            for i in range(PROMOTION_RETRIES):
                if promote_to_master():
                    logging.info("Redis successfully promoted to master.")
                    promoted = True
                    break
                logging.warning(f"Promotion attempt {i + 1}/{PROMOTION_RETRIES} failed.")
                time.sleep(2)

            if not promoted:
                logging.error("Failed to promote Redis to master, restarting container...")
                restart_redis()
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main() 