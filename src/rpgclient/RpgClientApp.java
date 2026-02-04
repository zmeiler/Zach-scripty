package rpgclient;

import java.awt.BorderLayout;
import java.awt.CardLayout;
import java.awt.Color;
import java.awt.Font;
import java.awt.event.ActionEvent;
import java.io.IOException;
import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextField;
import javax.swing.SwingUtilities;
import rpgserver.GameServer;

public class RpgClientApp {
    private final JFrame frame = new JFrame("Oakridge Online");
    private final CardLayout cards = new CardLayout();
    private final JPanel root = new JPanel(cards);
    private final ClientConnection connection = new ClientConnection();
    private final LoginPanel loginPanel = new LoginPanel(this::connect);
    private final JPanel loadingPanel = buildLoading();
    private final GamePanel gamePanel = new GamePanel(connection);
    private final JTextField chatField = new JTextField();
    private GameServer embeddedServer;

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
                    embeddedServer = new GameServer(5555);
                    new Thread(() -> {
                        try {
                            embeddedServer.start();
                        } catch (IOException ex) {
                            System.err.println("Server error: " + ex.getMessage());
                        }
                    }, "embedded-server").start();
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
        if (embeddedServer != null) {
            embeddedServer.stop();
            embeddedServer = null;
        }
        cards.show(root, "login");
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(RpgClientApp::new);
    }
}
