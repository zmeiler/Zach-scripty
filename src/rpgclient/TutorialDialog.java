package rpgclient;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Font;
import javax.swing.JButton;
import javax.swing.JDialog;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JTextArea;

public final class TutorialDialog {
    private TutorialDialog() {}

    public static void show(JFrame parent) {
        JDialog dialog = new JDialog(parent, "New Adventurer Tutorial", true);
        dialog.setSize(420, 320);
        dialog.setLocationRelativeTo(parent);
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(new Color(0x101010));
        JLabel title = new JLabel("Welcome to Oakridge", JLabel.CENTER);
        title.setFont(new Font("Monospaced", Font.BOLD, 16));
        title.setForeground(Color.WHITE);
        panel.add(title, BorderLayout.NORTH);
        JTextArea text = new JTextArea();
        text.setEditable(false);
        text.setWrapStyleWord(true);
        text.setLineWrap(true);
        text.setBackground(new Color(0x101010));
        text.setForeground(Color.LIGHT_GRAY);
        text.setText("WASD or click to move. Right-click a monster to attack.\n"
            + "Right-click a tree, vein, or fishing spot to gather resources.\n"
            + "Talk to Greta for guidance. Joran sells bread in exchange for coins.\n"
            + "Type /buy bread or /sell log|ore|fish near the shopkeeper.\n"
            + "Press 1 or 2 to change UI scale.");
        panel.add(text, BorderLayout.CENTER);
        JButton close = new JButton("Begin Adventure");
        close.addActionListener(e -> dialog.dispose());
        panel.add(close, BorderLayout.SOUTH);
        dialog.setContentPane(panel);
        dialog.setVisible(true);
    }
}
