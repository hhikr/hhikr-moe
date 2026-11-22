import javax.tools.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * A javac that stays warm. Started once with the library sources (LessonIO, Hot100Run), which it
 * compiles into the library folder; then reads one folder path per line on stdin, compiles that
 * folder's Main.java into folder/out against the library, and answers one line:
 * "OK base64" or "ERR base64", where the payload lists errors as "line\tcolumn\tmessage" lines.
 *
 * Annotation processing is off (-proc:none), so compiling never runs the reader's code.
 */
public final class Hot100Compiler {
    private static final JavaCompiler JAVAC = ToolProvider.getSystemJavaCompiler();
    private static final StandardJavaFileManager FILES = JAVAC.getStandardFileManager(null, Locale.SIMPLIFIED_CHINESE, StandardCharsets.UTF_8);

    public static void main(String[] args) throws Exception {
        Path library = Path.of(args[0]);
        Files.createDirectories(library);
        List<Path> sources = Arrays.stream(args).skip(1).map(Path::of).toList();
        String[] first = compile(sources, library, null);
        if (first[0] == null) {
            System.err.println(first[1]);
            System.exit(2);
        }
        PrintStream out = new PrintStream(new FileOutputStream(FileDescriptor.out), true, StandardCharsets.UTF_8);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        out.println("READY");
        for (String line; (line = in.readLine()) != null; ) {
            String reply;
            try {
                Path folder = Path.of(line.trim()), classes = folder.resolve("out");
                Files.createDirectories(classes);
                String[] result = compile(List.of(folder.resolve("Main.java")), classes, library);
                reply = (result[0] != null ? "OK " : "ERR ") + encode(result[1]);
            } catch (Exception e) {
                reply = "ERR " + encode("0\t0\t编译服务出错：" + e);
            }
            out.println(reply);
        }
    }

    /** Returns {"ok" or null, error listing}. */
    private static String[] compile(List<Path> sources, Path output, Path classpath) throws IOException {
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        FILES.setLocationFromPaths(StandardLocation.CLASS_OUTPUT, List.of(output));
        FILES.setLocationFromPaths(StandardLocation.CLASS_PATH, classpath == null ? List.of() : List.of(classpath));
        List<String> options = List.of("-encoding", "UTF-8", "-proc:none", "-g:source,lines", "-Xmaxerrs", "20", "-nowarn", "-implicit:none", "-Xlint:none");
        boolean ok = JAVAC.getTask(null, FILES, diagnostics, options, null, FILES.getJavaFileObjectsFromPaths(sources)).call();
        StringBuilder text = new StringBuilder();
        for (Diagnostic<? extends JavaFileObject> d : diagnostics.getDiagnostics()) {
            if (d.getKind() != Diagnostic.Kind.ERROR) continue;
            String message = d.getMessage(Locale.SIMPLIFIED_CHINESE).replace('\t', ' ').replace("\r", "").replace('\n', '\u0001');
            text.append(d.getLineNumber()).append('\t').append(d.getColumnNumber()).append('\t').append(message).append('\n');
        }
        return new String[]{ok ? "ok" : null, text.toString()};
    }

    private static String encode(String text) {
        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }
}
