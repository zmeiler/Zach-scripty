package rpgclient;

import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.DataLine;
import javax.sound.sampled.SourceDataLine;
import javax.sound.sampled.AudioSystem;

public final class AudioManager {
    private AudioManager() {}

    public static void playTone(int hz, int millis) {
        float sampleRate = 44100;
        byte[] buffer = new byte[1];
        AudioFormat format = new AudioFormat(sampleRate, 8, 1, true, false);
        try {
            DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
            try (SourceDataLine line = (SourceDataLine) AudioSystem.getLine(info)) {
                line.open(format);
                line.start();
                for (int i = 0; i < millis * (sampleRate / 1000); i++) {
                    double angle = i / (sampleRate / hz) * 2.0 * Math.PI;
                    buffer[0] = (byte) (Math.sin(angle) * 70);
                    line.write(buffer, 0, 1);
                }
                line.drain();
            }
        } catch (Exception ex) {
            System.err.println("Audio unavailable: " + ex.getMessage());
        }
    }
}
