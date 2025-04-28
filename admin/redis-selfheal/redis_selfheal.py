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
    try:
        logging.warning("Restarting redis container via docker compose...")
        subprocess.run(["docker", "compose", "restart", "redis"], check=True)
        logging.info("Redis container restarted.")
    except Exception as e:
        logging.error(f"Failed to restart redis: {e}")


def main():
    while True:
        if not is_redis_master():
            logging.error("Redis is not master! Attempting restart...")
            restart_redis()
        time.sleep(CHECK_INTERVAL)

if __name__ == "__main__":
    main() 