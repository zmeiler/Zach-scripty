package rpgclient;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.image.BufferedImage;
import java.util.EnumMap;
import rpgshared.Enums.EntityType;
import rpgshared.Enums.ItemType;
import rpgshared.Enums.TileType;

public class TileAtlas {
    private final EnumMap<TileType, BufferedImage> tiles = new EnumMap<>(TileType.class);
    private final EnumMap<EntityType, BufferedImage> entitySprites = new EnumMap<>(EntityType.class);
    private final EnumMap<ItemType, BufferedImage> itemSprites = new EnumMap<>(ItemType.class);

    public TileAtlas() {
        for (TileType type : TileType.values()) {
            tiles.put(type, createTile(type.color));
        }
        entitySprites.put(EntityType.PLAYER, createSprite(new Color(0x5f7fd1)));
        entitySprites.put(EntityType.MONSTER, createSprite(new Color(0xd15f5f)));
        entitySprites.put(EntityType.NPC, createSprite(new Color(0x5fd18f)));
        entitySprites.put(EntityType.RESOURCE, createSprite(new Color(0xd1b15f)));
        itemSprites.put(ItemType.BRONZE_SWORD, createItem(new Color(0x9f9f9f)));
        itemSprites.put(ItemType.BRONZE_AXE, createItem(new Color(0x8f6f3f)));
        itemSprites.put(ItemType.BRONZE_PICKAXE, createItem(new Color(0x8f8f8f)));
        itemSprites.put(ItemType.BRONZE_ARMOR, createItem(new Color(0x6f6f6f)));
        itemSprites.put(ItemType.LOG, createItem(new Color(0x8f5f2f)));
        itemSprites.put(ItemType.ORE, createItem(new Color(0x7f7f9f)));
        itemSprites.put(ItemType.FISH, createItem(new Color(0x5f8fd1)));
        itemSprites.put(ItemType.BREAD, createItem(new Color(0xd1b15f)));
        itemSprites.put(ItemType.COIN, createItem(new Color(0xd1cf5f)));
    }

    private BufferedImage createTile(int rgb) {
        BufferedImage image = new BufferedImage(32, 16, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setColor(new Color(rgb));
        Polygon poly = new Polygon();
        poly.addPoint(16, 0);
        poly.addPoint(31, 8);
        poly.addPoint(16, 15);
        poly.addPoint(0, 8);
        g.fillPolygon(poly);
        g.setColor(new Color(0x222222));
        g.drawPolygon(poly);
        g.dispose();
        return image;
    }

    private BufferedImage createSprite(Color color) {
        BufferedImage image = new BufferedImage(16, 24, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setColor(color.darker());
        g.fillRect(4, 10, 8, 10);
        g.setColor(color);
        g.fillRect(5, 2, 6, 8);
        g.dispose();
        return image;
    }

    private BufferedImage createItem(Color color) {
        BufferedImage image = new BufferedImage(12, 12, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.setColor(color);
        g.fillRect(2, 2, 8, 8);
        g.setColor(color.darker());
        g.drawRect(2, 2, 8, 8);
        g.dispose();
        return image;
    }

    public BufferedImage tile(TileType type) {
        return tiles.get(type);
    }

    public BufferedImage sprite(EntityType type) {
        return entitySprites.get(type);
    }

    public BufferedImage item(ItemType type) {
        return itemSprites.getOrDefault(type, itemSprites.get(ItemType.LOG));
    }
}
