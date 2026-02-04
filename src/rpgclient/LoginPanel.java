package rpgclient;

import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import java.awt.Insets;
import java.awt.event.ActionEvent;
import javax.swing.JButton;
import javax.swing.JCheckBox;
import javax.swing.JComboBox;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JPasswordField;
import javax.swing.JTextField;

public class LoginPanel extends JPanel {
    private final JTextField usernameField = new JTextField(12);
    private final JPasswordField passwordField = new JPasswordField(12);
    private final JComboBox<String> bodyBox = new JComboBox<>(new String[]{"Pale", "Tan", "Deep"});
    private final JComboBox<String> hairBox = new JComboBox<>(new String[]{"Short", "Braids", "Wild"});
    private final JComboBox<String> colorBox = new JComboBox<>(new String[]{"Blue", "Red", "Green"});
    private final JCheckBox guestBox = new JCheckBox("Guest mode");
    private final JCheckBox singleBox = new JCheckBox("Single-player (offline)");
    private final JButton connectButton = new JButton("Enter World");

    public LoginPanel(Runnable onConnect) {
        setLayout(new BorderLayout());
        setBackground(new Color(0x101010));
        JPanel form = new JPanel(new GridBagLayout());
        form.setOpaque(false);
        GridBagConstraints gc = new GridBagConstraints();
        gc.insets = new Insets(6, 6, 6, 6);
        gc.gridx = 0;
        gc.gridy = 0;
        gc.anchor = GridBagConstraints.WEST;
        form.add(label("Name:"), gc);
        gc.gridx = 1;
        form.add(usernameField, gc);
        gc.gridx = 0;
        gc.gridy++;
        form.add(label("Password:"), gc);
        gc.gridx = 1;
        form.add(passwordField, gc);
        gc.gridx = 0;
        gc.gridy++;
        form.add(label("Body:"), gc);
        gc.gridx = 1;
        form.add(bodyBox, gc);
        gc.gridx = 0;
        gc.gridy++;
        form.add(label("Hair:"), gc);
        gc.gridx = 1;
        form.add(hairBox, gc);
        gc.gridx = 0;
        gc.gridy++;
        form.add(label("Clothing:"), gc);
        gc.gridx = 1;
        form.add(colorBox, gc);
        gc.gridx = 0;
        gc.gridy++;
        gc.gridwidth = 2;
        form.add(guestBox, gc);
        gc.gridy++;
        form.add(singleBox, gc);
        gc.gridy++;
        form.add(connectButton, gc);
        add(form, BorderLayout.CENTER);
        connectButton.addActionListener((ActionEvent e) -> onConnect.run());
        setPreferredSize(new Dimension(480, 360));
    }

    private JLabel label(String text) {
        JLabel label = new JLabel(text);
        label.setForeground(Color.WHITE);
        return label;
    }

    public String username() {
        return usernameField.getText().trim();
    }

    public String password() {
        return new String(passwordField.getPassword());
    }

    public boolean guest() {
        return guestBox.isSelected();
    }

    public boolean singlePlayer() {
        return singleBox.isSelected();
    }

    public String appearance() {
        return "body:" + bodyBox.getSelectedIndex() + ";hair:" + hairBox.getSelectedIndex() + ";color:" + colorBox.getSelectedIndex();
    }
}
