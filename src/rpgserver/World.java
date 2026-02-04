package rpgserver;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import rpgshared.Enums.TileType;

public class World {
    public final int width;
    public final int height;
    private final TileType[][] tiles;
    private final String[][] areaNames;
    private int castleLadderX;
    private int castleLadderY;
    private int dungeonLadderX;
    private int dungeonLadderY;

    public World(int width, int height) {
        this.width = width;
        this.height = height;
        this.tiles = new TileType[width][height];
        this.areaNames = new String[width / 20][height / 20];
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
        buildAreas();
    }

    private void buildAreas() {
        String[] names = {
            "Oakridge Village",
            "Mosswood",
            "Glimmer Lake",
            "Ashen Mine",
            "Stonegate Keep",
            "Cavern of Echoes",
            "Briar Hollow",
            "Wandering Plains",
            "Sunlit Meadow",
            "Old Watchtower",
            "Fogbound Marsh",
            "Windbreak Ridge",
            "Silverbrook",
            "Redleaf Grove",
            "Moonlit Crossing",
            "Frostfield",
            "Bandit Camp",
            "Sage Hill",
            "Driftwood Shore",
            "Thornpass",
            "Deeproot Forest",
            "Ember Trail",
            "Riverbend",
            "Cragspire",
            "Dawnfield",
            "Wildwood",
            "Seafarer Cove",
            "Ancient Ruins",
            "Whispering Fen",
            "Highstone Gate"
        };
        int index = 0;
        for (int ax = 0; ax < areaNames.length; ax++) {
            for (int ay = 0; ay < areaNames[0].length; ay++) {
                areaNames[ax][ay] = names[index % names.length];
                index++;
            }
        }
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
        castleLadderX = startX + w / 2;
        castleLadderY = startY + h / 2;
        tiles[castleLadderX][castleLadderY] = TileType.LADDER;
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
        dungeonLadderX = startX + w / 2;
        dungeonLadderY = startY + h / 2;
        tiles[dungeonLadderX][dungeonLadderY] = TileType.LADDER;
    }

    public int[] ladderDestination(int x, int y) {
        if (x == castleLadderX && y == castleLadderY) {
            return new int[]{dungeonLadderX, dungeonLadderY};
        }
        if (x == dungeonLadderX && y == dungeonLadderY) {
            return new int[]{castleLadderX, castleLadderY};
        }
        return null;
    }

    public TileType tile(int x, int y) {
        if (x < 0 || y < 0 || x >= width || y >= height) {
            return TileType.WALL;
        }
        return tiles[x][y];
    }

    public boolean walkable(int x, int y) {
        return tile(x, y).walkable;
    }

    public String areaName(int x, int y) {
        int ax = Math.max(0, Math.min(areaNames.length - 1, x / 20));
        int ay = Math.max(0, Math.min(areaNames[0].length - 1, y / 20));
        return areaNames[ax][ay];
    }

    public List<int[]> neighbors(int x, int y) {
        List<int[]> list = new ArrayList<>();
        int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};
        for (int[] d : dirs) {
            int nx = x + d[0];
            int ny = y + d[1];
            if (walkable(nx, ny)) {
                list.add(new int[]{nx, ny});
            }
        }
        return list;
    }
}
