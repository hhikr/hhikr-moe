import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.Callable;

/**
 * Runs one test case of a reader's program and reports it on the real stdout as one line:
 * "@@H100 index status micros base64(result) base64(printed)". Whatever the reader's code prints
 * goes to a small buffer instead, so debug prints never break the result.
 */
public final class Hot100Run {
    private static final PrintStream OUT = new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8);
    private static final int CAPTURE = 4096;

    private Hot100Run() {}

    public static void run(int index, Callable<Object> body) {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        PrintStream capture = new PrintStream(new OutputStream() {
            @Override public void write(int b) { if (buffer.size() < CAPTURE) buffer.write(b); }
            @Override public void write(byte[] b, int off, int len) {
                int n = Math.min(len, CAPTURE - buffer.size());
                if (n > 0) buffer.write(b, off, n);
            }
        }, true, StandardCharsets.UTF_8);
        System.setOut(capture);
        System.setErr(capture);
        String status = "ok", value;
        long start = System.nanoTime();
        try {
            value = LessonIO.format(body.call());
        } catch (Throwable e) {
            status = "error";
            value = describe(e);
        }
        long micros = (System.nanoTime() - start) / 1000;
        capture.flush();
        OUT.println("@@H100 " + index + " " + status + " " + micros + " " + encode(value) + " " + encode(buffer.toString(StandardCharsets.UTF_8)));
    }

    private static String encode(String text) {
        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }

    /** Exception name, message and the reader's line where it was thrown. */
    private static String describe(Throwable e) {
        StringBuilder text = new StringBuilder(e.getClass().getName().replaceFirst("^java\\.lang\\.", ""));
        if (e.getMessage() != null) text.append(": ").append(e.getMessage());
        for (StackTraceElement frame : e.getStackTrace()) {
            if ("Main.java".equals(frame.getFileName()) && !frame.getClassName().startsWith("Hot100Judge") && frame.getLineNumber() > 0) {
                text.append("\n  位置：第 ").append(frame.getLineNumber()).append(" 行，").append(frame.getClassName()).append('.').append(frame.getMethodName());
                break;
            }
        }
        return text.toString();
    }
}
