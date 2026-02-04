package rpgclient;

import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.RenderingHints;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import javax.swing.JPanel;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import rpgshared.EntityState;
import rpgshared.Enums.EntityType;
import rpgshared.Enums.ItemType;
import rpgshared.Enums.SkillType;
import rpgshared.Enums.TileType;

public class GamePanel extends JPanel {
    private final ClientConnection connection;
    private final TileAtlas atlas = new TileAtlas();
    private WorldView worldView;
    private int scale = 2;
    private int cameraX;
    private int cameraY;
    private String statusMessage = "";
    private final List<FloatingText> floating = new ArrayList<>();
    private final List<int[]> pathQueue = new ArrayList<>();
    private long lastMoveTime;

    public GamePanel(ClientConnection connection) {
        this.connection = connection;
        setPreferredSize(new Dimension(960, 720));
        setBackground(Color.BLACK);
        setFocusable(true);
        addKeyListener(new KeyHandler());
        addMouseListener(new MouseHandler());
        Timer timer = new Timer(33, e -> {
            updateLocal();
            repaint();
        });
        timer.start();
    }

    public void setWorld(int width, int height) {
        worldView = new WorldView(width, height);
    }

    private void updateLocal() {
        int px = connection.playerX();
        int py = connection.playerY();
        cameraX = px;
        cameraY = py;
        if (!pathQueue.isEmpty() && System.currentTimeMillis() - lastMoveTime > 180) {
            int[] next = pathQueue.remove(0);
            try {
                connection.requestMove(next[0], next[1]);
                lastMoveTime = System.currentTimeMillis();
            } catch (Exception ex) {
                statusMessage = "Path failed.";
                pathQueue.clear();
            }
        }
        if (!connection.notifyLog().isEmpty()) {
            statusMessage = connection.notifyLog().get(connection.notifyLog().size() - 1);
        }
        floating.removeIf(f -> f.life <= 0);
        for (FloatingText text : floating) {
            text.life--;
            text.yOffset -= 0.2f;
        }
    }

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);
        if (worldView == null) {
            return;
        }
        Graphics2D g = (Graphics2D) graphics;
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_OFF);

        int width = getWidth();
        int height = getHeight();
        int tileW = 32 * scale;
        int tileH = 16 * scale;
        int offsetX = width / 2;
        int offsetY = height / 2 - 100;

        int viewRadius = 14;
        List<EntityState> entityList = new ArrayList<>(connection.entities().values());
        entityList.sort(Comparator.comparingInt(e -> e.x + e.y));

        for (int dx = -viewRadius; dx <= viewRadius; dx++) {
            for (int dy = -viewRadius; dy <= viewRadius; dy++) {
                int x = cameraX + dx;
                int y = cameraY + dy;
                TileType tile = worldView.tile(x, y);
                int screenX = (x - y) * tileW / 2 + offsetX;
                int screenY = (x + y) * tileH / 2 + offsetY;
                g.drawImage(atlas.tile(tile), screenX, screenY, tileW, tileH, null);
            }
        }

        for (EntityState entity : entityList) {
            if (Math.abs(entity.x - cameraX) > viewRadius || Math.abs(entity.y - cameraY) > viewRadius) {
                continue;
            }
            int screenX = (entity.x - entity.y) * tileW / 2 + offsetX;
            int screenY = (entity.x + entity.y) * tileH / 2 + offsetY;
            int spriteW = 16 * scale;
            int spriteH = 24 * scale;
            g.drawImage(atlas.sprite(entity.type), screenX + tileW / 4, screenY - spriteH + tileH / 2, spriteW, spriteH, null);
            drawHpBar(g, entity, screenX + tileW / 2, screenY - spriteH);
            g.setColor(Color.WHITE);
            g.setFont(new Font("Monospaced", Font.PLAIN, 10 * scale / 2));
            g.drawString(entity.name, screenX - 10, screenY - spriteH - 4);
        }

        drawUi(g, width, height);
    }

    private void drawHpBar(Graphics2D g, EntityState entity, int x, int y) {
        int barWidth = 32 * scale / 2;
        int barHeight = 4 * scale / 2;
        g.setColor(Color.DARK_GRAY);
        g.fillRect(x - barWidth / 2, y, barWidth, barHeight);
        float pct = entity.maxHp == 0 ? 0f : (float) entity.hp / entity.maxHp;
        g.setColor(new Color(0x6bd16b));
        g.fillRect(x - barWidth / 2, y, (int) (barWidth * pct), barHeight);
    }

    private void drawUi(Graphics2D g, int width, int height) {
        g.setColor(new Color(0x202020));
        g.fillRect(12, 12, 220, 140);
        g.setColor(Color.WHITE);
        g.drawRect(12, 12, 220, 140);
        g.setFont(new Font("Monospaced", Font.BOLD, 12));
        g.drawString("Area: " + connection.areaName(), 20, 32);
        g.drawString("HP: " + connection.hp() + "/" + connection.maxHp(), 20, 48);
        g.drawString("ATK: " + connection.skills().level(SkillType.ATTACK), 20, 64);
        g.drawString("STR: " + connection.skills().level(SkillType.STRENGTH), 20, 80);
        g.drawString("DEF: " + connection.skills().level(SkillType.DEFENSE), 20, 96);
        g.drawString("MIN: " + connection.skills().level(SkillType.MINING), 120, 64);
        g.drawString("WOOD: " + connection.skills().level(SkillType.WOODCUTTING), 120, 80);
        g.drawString("FISH: " + connection.skills().level(SkillType.FISHING), 120, 96);
        drawPlayerList(g, 12, 160);

        drawInventory(g, width - 260, height - 180);
        drawMinimap(g, width - 160, 20);
        drawChat(g, 12, height - 150, width / 2);

        if (!statusMessage.isBlank()) {
            g.setColor(new Color(0x101010, true));
            g.fillRect(width / 2 - 200, height - 60, 400, 40);
            g.setColor(Color.WHITE);
            g.drawRect(width / 2 - 200, height - 60, 400, 40);
            g.drawString(statusMessage, width / 2 - 190, height - 36);
        }

        drawFloating(g, width, height);
    }

    private void drawPlayerList(Graphics2D g, int x, int y) {
        g.setColor(new Color(0x202020));
        g.fillRect(x, y, 220, 110);
        g.setColor(Color.WHITE);
        g.drawRect(x, y, 220, 110);
        g.drawString("Players", x + 8, y + 16);
        int line = 0;
        for (EntityState entity : connection.entities().values()) {
            if (entity.type == EntityType.PLAYER) {
                g.drawString(entity.name, x + 8, y + 32 + line * 14);
                line++;
                if (line > 5) {
                    break;
                }
            }
        }
    }

    private void drawInventory(Graphics2D g, int x, int y) {
        g.setColor(new Color(0x202020));
        g.fillRect(x, y, 240, 160);
        g.setColor(Color.WHITE);
        g.drawRect(x, y, 240, 160);
        g.drawString("Inventory", x + 8, y + 16);
        g.drawString("Equip", x + 150, y + 16);
        g.drawImage(atlas.item(connection.equipment().get(rpgshared.Equipment.Slot.WEAPON)), x + 150, y + 26, 16, 16, null);
        g.drawImage(atlas.item(connection.equipment().get(rpgshared.Equipment.Slot.ARMOR)), x + 180, y + 26, 16, 16, null);
        int slotSize = 28;
        int index = 0;
        for (var stack : connection.inventory().items()) {
            int sx = x + 8 + (index % 6) * (slotSize + 4);
            int sy = y + 24 + (index / 6) * (slotSize + 4);
            g.setColor(new Color(0x333333));
            g.fillRect(sx, sy, slotSize, slotSize);
            g.drawImage(atlas.item(stack.type), sx + 6, sy + 6, 16, 16, null);
            g.setColor(Color.WHITE);
            g.drawString(String.valueOf(stack.amount), sx + 2, sy + slotSize - 4);
            index++;
        }
    }

    private void drawMinimap(Graphics2D g, int x, int y) {
        int mapSize = 120;
        g.setColor(new Color(0x202020));
        g.fillRect(x, y, mapSize, mapSize);
        g.setColor(Color.WHITE);
        g.drawRect(x, y, mapSize, mapSize);
        for (int dx = -10; dx <= 10; dx++) {
            for (int dy = -10; dy <= 10; dy++) {
                int wx = connection.playerX() + dx;
                int wy = connection.playerY() + dy;
                TileType tile = worldView.tile(wx, wy);
                g.setColor(new Color(tile.color));
                int px = x + mapSize / 2 + dx * 2;
                int py = y + mapSize / 2 + dy * 2;
                g.fillRect(px, py, 2, 2);
            }
        }
        g.setColor(Color.RED);
        g.fillRect(x + mapSize / 2 - 2, y + mapSize / 2 - 2, 4, 4);
    }

    private void drawChat(Graphics2D g, int x, int y, int width) {
        g.setColor(new Color(0x202020));
        g.fillRect(x, y, width, 130);
        g.setColor(Color.WHITE);
        g.drawRect(x, y, width, 130);
        g.drawString("Chat", x + 8, y + 16);
        List<String> chat = connection.chatLog();
        int start = Math.max(0, chat.size() - 6);
        for (int i = start; i < chat.size(); i++) {
            g.drawString(chat.get(i), x + 8, y + 34 + (i - start) * 16);
        }
    }

    private void drawFloating(Graphics2D g, int width, int height) {
        g.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.9f));
        g.setColor(Color.YELLOW);
        for (FloatingText text : floating) {
            int screenX = (text.x - cameraX) * 32 * scale / 2 + width / 2;
            int screenY = (text.y + text.x - cameraY * 2) * 16 * scale / 2 + height / 2;
            g.drawString(text.text, screenX, screenY + (int) text.yOffset);
        }
        g.setComposite(AlphaComposite.SrcOver);
    }

    private class KeyHandler extends KeyAdapter {
        @Override
        public void keyPressed(KeyEvent e) {
            int dx = 0;
            int dy = 0;
            if (e.getKeyCode() == KeyEvent.VK_W || e.getKeyCode() == KeyEvent.VK_UP) {
                dy = -1;
            } else if (e.getKeyCode() == KeyEvent.VK_S || e.getKeyCode() == KeyEvent.VK_DOWN) {
                dy = 1;
            } else if (e.getKeyCode() == KeyEvent.VK_A || e.getKeyCode() == KeyEvent.VK_LEFT) {
                dx = -1;
            } else if (e.getKeyCode() == KeyEvent.VK_D || e.getKeyCode() == KeyEvent.VK_RIGHT) {
                dx = 1;
            } else if (e.getKeyCode() == KeyEvent.VK_1) {
                scale = 2;
            } else if (e.getKeyCode() == KeyEvent.VK_2) {
                scale = 3;
            }
            if (dx != 0 || dy != 0) {
                try {
                    pathQueue.clear();
                    connection.requestMove(connection.playerX() + dx, connection.playerY() + dy);
                    connection.setPlayerPosition(connection.playerX() + dx, connection.playerY() + dy);
                } catch (Exception ex) {
                    statusMessage = "Movement failed.";
                }
            }
        }
    }

    private class MouseHandler extends MouseAdapter {
        @Override
        public void mousePressed(MouseEvent e) {
            requestFocusInWindow();
            if (SwingUtilities.isLeftMouseButton(e)) {
                Point tile = screenToTile(e.getPoint());
                if (tile != null) {
                    try {
                        pathQueue.clear();
                        pathQueue.addAll(ClientPathfinding.findPath(worldView, connection.playerX(), connection.playerY(), tile.x, tile.y, 40));
                    } catch (Exception ex) {
                        statusMessage = "Move failed.";
                    }
                }
            } else if (SwingUtilities.isRightMouseButton(e)) {
                EntityState target = findEntityAt(e.getPoint());
                if (target != null && target.type == EntityType.MONSTER) {
                    try {
                        connection.requestAttack(target.id);
                        floating.add(new FloatingText("Attack!", target.x, target.y));
                        AudioManager.playTone(440, 80);
                    } catch (Exception ex) {
                        statusMessage = "Attack failed.";
                    }
                } else if (target != null && (target.type == EntityType.NPC || target.type == EntityType.RESOURCE)) {
                    try {
                        connection.requestInteract(target.x, target.y);
                        AudioManager.playTone(330, 60);
                    } catch (Exception ex) {
                        statusMessage = "Interact failed.";
                    }
                }
            }
        }
    }

    private EntityState findEntityAt(Point point) {
        int tileW = 32 * scale;
        int tileH = 16 * scale;
        int offsetX = getWidth() / 2;
        int offsetY = getHeight() / 2 - 100;
        for (EntityState entity : connection.entities().values()) {
            int screenX = (entity.x - entity.y) * tileW / 2 + offsetX;
            int screenY = (entity.x + entity.y) * tileH / 2 + offsetY;
            if (point.x >= screenX && point.x <= screenX + tileW && point.y >= screenY - tileH && point.y <= screenY + tileH) {
                return entity;
            }
        }
        return null;
    }

    private Point screenToTile(Point point) {
        int tileW = 32 * scale;
        int tileH = 16 * scale;
        int offsetX = getWidth() / 2;
        int offsetY = getHeight() / 2 - 100;
        int isoX = point.x - offsetX;
        int isoY = point.y - offsetY;
        int x = (isoX / (tileW / 2) + isoY / (tileH / 2)) / 2;
        int y = (isoY / (tileH / 2) - isoX / (tileW / 2)) / 2;
        return new Point(x, y);
    }

    private static class FloatingText {
        final String text;
        final int x;
        final int y;
        float yOffset;
        int life = 40;

        FloatingText(String text, int x, int y) {
            this.text = text;
            this.x = x;
            this.y = y;
        }
    }
}
