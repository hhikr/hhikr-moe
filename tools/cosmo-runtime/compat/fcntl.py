"""Windows flock compatibility for the development ledger's whole-file locks."""
import errno
import msvcrt
import os
import time

LOCK_SH = 1
LOCK_EX = 2
LOCK_NB = 4
LOCK_UN = 8


def flock(file, operation):
    fd = file if isinstance(file, int) else file.fileno()
    position = os.lseek(fd, 0, os.SEEK_CUR)
    os.lseek(fd, 0, os.SEEK_SET)
    try:
        if operation & LOCK_UN:
            msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
            return
        mode = msvcrt.LK_NBRLCK if operation & LOCK_SH else msvcrt.LK_NBLCK
        while True:
            try:
                msvcrt.locking(fd, mode, 1)
                return
            except OSError as error:
                if error.errno not in (errno.EACCES, errno.EDEADLK) or operation & LOCK_NB:
                    raise
                time.sleep(0.05)
    finally:
        os.lseek(fd, position, os.SEEK_SET)
