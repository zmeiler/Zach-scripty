package rpgclient;

import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.io.IOException;
import java.lang.reflect.Constructor;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;

public class RpgClientApp {
    private final JFrame frame = new JFrame("Oakridge Online");
    private final CardLayout cards = new CardLayout();
    private final JPanel root = new JPanel(cards);
    private final ClientConnection connection = new ClientConnection();
    private final LoginPanel loginPanel = new LoginPanel(this::connect);
    private final JPanel loadingPanel = buildLoading();
    private final GamePanel gamePanel = new GamePanel(connection);
    private final JTextField chatField = new JTextField();
    private Object embeddedServer;
    private Process embeddedServerProcess;

    public RpgClientApp() {
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        root.add(loginPanel, "login");
        root.add(loadingPanel, "loading");
        root.add(buildGameView(), "game");
        frame.setContentPane(root);
        frame.pack();
        frame.setLocationRelativeTo(null);
        frame.setVisible(true);
        cards.show(root, "login");
    }

    private JPanel buildLoading() {
        JPanel panel = new JPanel(new BorderLayout());
        JLabel label = new JLabel("Loading world...", JLabel.CENTER);
        label.setFont(new Font("Monospaced", Font.BOLD, 18));
        label.setForeground(Color.WHITE);
        panel.setBackground(new Color(0x101010));
        panel.add(label, BorderLayout.CENTER);
        return panel;
    }

    private JPanel buildGameView() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.add(gamePanel, BorderLayout.CENTER);
        JPanel bottom = new JPanel(new BorderLayout());
        bottom.add(chatField, BorderLayout.CENTER);
        JButton sendButton = new JButton("Send");
        bottom.add(sendButton, BorderLayout.EAST);
        JButton logout = new JButton("Logout");
        bottom.add(logout, BorderLayout.WEST);
        panel.add(bottom, BorderLayout.SOUTH);
        sendButton.addActionListener(this::sendChat);
        chatField.addActionListener(this::sendChat);
        logout.addActionListener(e -> logout());
        return panel;
    }

    private void connect() {
        cards.show(root, "loading");
        new Thread(() -> {
            try {
                if (loginPanel.singlePlayer()) {
                    startEmbeddedServer();
                    Thread.sleep(300);
                }
                connection.connect("127.0.0.1", 5555);
                connection.sendLogin(loginPanel.username(), loginPanel.password(), loginPanel.appearance(), loginPanel.guest());
                int attempts = 0;
                while (connection.worldWidth() == 0 && attempts < 30) {
                    Thread.sleep(100);
                    attempts++;
                }
                gamePanel.setWorld(connection.worldWidth(), connection.worldHeight());
                SwingUtilities.invokeLater(() -> {
                    cards.show(root, "game");
                    gamePanel.requestFocusInWindow();
                });
                SwingUtilities.invokeLater(() -> TutorialDialog.show(frame));
            } catch (Exception ex) {
                SwingUtilities.invokeLater(() -> {
                    cards.show(root, "login");
                });
            }
        }, "connect-thread").start();
    }

    private void sendChat(ActionEvent event) {
        String message = chatField.getText().trim();
        if (message.isEmpty()) {
            return;
        }
        try {
            connection.sendChat(message);
            chatField.setText("");
        } catch (IOException ex) {
            System.err.println("Chat error: " + ex.getMessage());
        }
    }

    private void logout() {
        connection.disconnect();
        stopEmbeddedServer();
        cards.show(root, "login");
    }

    private void startEmbeddedServer() throws Exception {
        embeddedServer = tryStartInProcessServer(5555);
        if (embeddedServer == null) {
            embeddedServerProcess = startServerProcess(5555);
        }
    }

    private Object tryStartInProcessServer(int port) {
        try {
            Class<?> serverClass = Class.forName("rpgserver.GameServer");
            Constructor<?> constructor = serverClass.getConstructor(int.class);
            Object server = constructor.newInstance(port);
            Method start = serverClass.getMethod("start");
            new Thread(() -> {
                try {
                    start.invoke(server);
                } catch (Exception ex) {
                    System.err.println("Server error: " + ex.getMessage());
                }
            }, "embedded-server").start();
            return server;
        } catch (Exception ex) {
            return null;
        }
    }

    private Process startServerProcess(int port) throws IOException {
        Path jarPath = Path.of("build", "server.jar");
        if (!Files.exists(jarPath)) {
            jarPath = Path.of("server.jar");
        }
        if (!Files.exists(jarPath)) {
            throw new IOException("Server jar not found. Expected build/server.jar or server.jar.");
        }
        String javaBin = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        ProcessBuilder builder = new ProcessBuilder(javaBin, "-jar", jarPath.toString(), String.valueOf(port));
        builder.redirectErrorStream(true);
        return builder.start();
    }

    private void stopEmbeddedServer() {
        if (embeddedServer != null) {
            try {
                Method stop = embeddedServer.getClass().getMethod("stop");
                stop.invoke(embeddedServer);
            } catch (Exception ex) {
                System.err.println("Server stop error: " + ex.getMessage());
            } finally {
                embeddedServer = null;
            }
        }
        if (embeddedServerProcess != null) {
            embeddedServerProcess.destroy();
            embeddedServerProcess = null;
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(RpgClientApp::new);
    }
}
