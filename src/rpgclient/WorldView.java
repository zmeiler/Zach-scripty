package rpgclient;

import java.util.Random;
import rpgshared.Enums.TileType;

public class WorldView {
    private final int width;
    private final int height;
    private final TileType[][] tiles;

    public WorldView(int width, int height) {
        this.width = width;
        this.height = height;
        this.tiles = new TileType[width][height];
        generate();
    }

    private void generate() {
        Random random = new Random(1337);
        for (int x = 0; x < width; x++) {
            for (int y = 0; y < height; y++) {
                double noise = (Math.sin(x * 0.12) + Math.cos(y * 0.11) + random.nextDouble() * 0.4) / 2.4;
                TileType tile = TileType.GRASS;
                if (noise < -0.25) {
                    tile = TileType.WATER;
                } else if (noise < -0.05) {
                    tile = TileType.SAND;
                } else if (noise > 0.55) {
                    tile = TileType.STONE;
                } else if (noise > 0.3) {
                    tile = TileType.DIRT;
                }
                tiles[x][y] = tile;
            }
        }
        for (int x = 10; x < width - 10; x++) {
            tiles[x][height / 2] = TileType.ROAD;
        }
        for (int y = 10; y < height - 10; y++) {
            tiles[width / 2][y] = TileType.ROAD;
        }
        placeCastle(85, 25, 12, 10);
        placeDungeon(90, 95, 10, 8);
    }

    public TileType tile(int x, int y) {
        if (x < 0 || y < 0 || x >= width || y >= height) {
            return TileType.WALL;
        }
        return tiles[x][y];
    }

    private void placeCastle(int startX, int startY, int w, int h) {
        for (int x = startX; x < startX + w; x++) {
            for (int y = startY; y < startY + h; y++) {
                if (x == startX || y == startY || x == startX + w - 1 || y == startY + h - 1) {
                    tiles[x][y] = TileType.WALL;
                } else {
                    tiles[x][y] = TileType.WOOD_FLOOR;
                }
            }
        }
        tiles[startX + w / 2][startY + h - 1] = TileType.DOOR;
        tiles[startX + w / 2][startY + h / 2] = TileType.LADDER;
    }

    private void placeDungeon(int startX, int startY, int w, int h) {
        for (int x = startX; x < startX + w; x++) {
            for (int y = startY; y < startY + h; y++) {
                if (x == startX || y == startY || x == startX + w - 1 || y == startY + h - 1) {
                    tiles[x][y] = TileType.WALL;
                } else {
                    tiles[x][y] = TileType.STONE;
                }
            }
        }
        tiles[startX + w / 2][startY + h / 2] = TileType.LADDER;
    }
}
