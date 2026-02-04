import random

TILE_SIZE = 1
MAP_WIDTH = 30
MAP_HEIGHT = 20

WALL = "#"
FLOOR = "."


def generate_map(seed: int = 7) -> list[list[str]]:
    rng = random.Random(seed)
    grid = [[FLOOR for _ in range(MAP_WIDTH)] for _ in range(MAP_HEIGHT)]
    for y in range(MAP_HEIGHT):
        for x in range(MAP_WIDTH):
            if x == 0 or y == 0 or x == MAP_WIDTH - 1 or y == MAP_HEIGHT - 1:
                grid[y][x] = WALL
            elif rng.random() < 0.08:
                grid[y][x] = WALL
    for x in range(2, MAP_WIDTH - 2):
        grid[MAP_HEIGHT // 2][x] = FLOOR
    return grid


def is_walkable(grid: list[list[str]], x: int, y: int) -> bool:
    if x < 0 or y < 0 or x >= MAP_WIDTH or y >= MAP_HEIGHT:
        return False
    return grid[y][x] != WALL
