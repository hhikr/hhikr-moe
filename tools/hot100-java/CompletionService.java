import java.io.*;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.*;
import javax.lang.model.element.*;
import javax.lang.model.type.*;
import javax.lang.model.util.*;
import javax.tools.*;
import com.sun.source.tree.*;
import com.sun.source.util.*;

public class CompletionService {
    private static final String MARKER = "__HOT100_COMPLETION__";
    private static String library = "";
    private static final Pattern MEMBER = Pattern.compile("\\.([A-Za-z_$][A-Za-z0-9_$]*)?$");

    private static String quoted(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t") + "\"";
    }

    private static String shortType(TypeMirror type) {
        return type.toString().replace("java.lang.", "").replace("java.util.", "").replace("java.io.", "");
    }

    private static String complete(String source, int cursor) throws Exception {
        if (cursor < 0 || cursor > source.length()) return "[]";
        Matcher match = MEMBER.matcher(source.substring(0, cursor));
        if (!match.find()) return "[]";
        String prefix = match.group(1) == null ? "" : match.group(1);
        int prefixStart = cursor - prefix.length();
        String suffix = source.substring(cursor);
        String next = suffix.stripLeading();
        String terminator = next.startsWith(";") || next.startsWith(")") || next.startsWith(",") ? "" : ";";
        String patched = source.substring(0, prefixStart) + MARKER + "()" + terminator + suffix;
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) return "[]";
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        try (StandardJavaFileManager manager = compiler.getStandardFileManager(diagnostics, null, StandardCharsets.UTF_8)) {
            JavaFileObject file = new SimpleJavaFileObject(URI.create("string:///Main.java"), JavaFileObject.Kind.SOURCE) {
                @Override public CharSequence getCharContent(boolean ignoreEncodingErrors) { return patched; }
            };
            List<JavaFileObject> files = new ArrayList<>(); files.add(file);
            if (!library.isEmpty()) files.add(new SimpleJavaFileObject(URI.create("string:///LessonIO.java"), JavaFileObject.Kind.SOURCE) {
                @Override public CharSequence getCharContent(boolean ignoreEncodingErrors) { return library; }
            });
            JavacTask task = (JavacTask) compiler.getTask(null, manager, diagnostics, List.of("-proc:none", "-Xlint:none"), null, files);
            List<CompilationUnitTree> units = new ArrayList<>();
            task.parse().forEach(units::add);
            try { task.analyze(); } catch (RuntimeException ignored) { }
            Trees trees = Trees.instance(task);
            Types types = task.getTypes();
            Elements elements = task.getElements();
            TypeMirror[] receiver = {null};
            for (CompilationUnitTree unit : units) {
                new TreePathScanner<Void, Void>() {
                    @Override public Void visitMemberSelect(MemberSelectTree node, Void unused) {
                        if (node.getIdentifier().contentEquals(MARKER)) {
                            receiver[0] = trees.getTypeMirror(new TreePath(getCurrentPath(), node.getExpression()));
                        }
                        return super.visitMemberSelect(node, unused);
                    }
                }.scan(unit, null);
            }
            if (receiver[0] == null) return "[]";
            if (receiver[0].getKind() == TypeKind.ARRAY) {
                return "length".startsWith(prefix) ? "[{\"label\":\"length\",\"insertText\":\"length\",\"detail\":\"int · 数组长度\"}]" : "[]";
            }
            if (!(receiver[0] instanceof DeclaredType declared)) return "[]";
            TypeElement owner = (TypeElement) declared.asElement();
            TreeMap<String, String> suggestions = new TreeMap<>();
            for (Element member : elements.getAllMembers(owner)) {
                if (!member.getModifiers().contains(Modifier.PUBLIC)) continue;
                String name = member.getSimpleName().toString();
                if (!name.startsWith(prefix)) continue;
                if (member instanceof ExecutableElement method && member.getKind() == ElementKind.METHOD) {
                    ExecutableType resolved = (ExecutableType) types.asMemberOf(declared, method);
                    List<String> arguments = new ArrayList<>();
                    for (int i = 0; i < resolved.getParameterTypes().size(); i++) {
                        arguments.add(shortType(resolved.getParameterTypes().get(i)) + " " + method.getParameters().get(i).getSimpleName());
                    }
                    String label = name + "(" + String.join(", ", arguments) + ")";
                    String insert = name + "()";
                    String detail = shortType(resolved.getReturnType()) + " · " + owner.getQualifiedName();
                    suggestions.put(label, "{\"label\":" + quoted(label) + ",\"insertText\":" + quoted(insert) + ",\"detail\":" + quoted(detail) + ",\"parameterCount\":" + arguments.size() + "}");
                } else if (member.getKind() == ElementKind.FIELD) {
                    String detail = shortType(types.asMemberOf(declared, member));
                    suggestions.put(name, "{\"label\":" + quoted(name) + ",\"insertText\":" + quoted(name) + ",\"detail\":" + quoted(detail) + "}");
                }
            }
            return "[" + String.join(",", suggestions.values().stream().limit(80).toList()) + "]";
        }
    }

    public static void main(String[] args) throws IOException {
        if (args.length > 0) library = java.nio.file.Files.readString(java.nio.file.Path.of(args[0]), StandardCharsets.UTF_8);
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));
        PrintWriter writer = new PrintWriter(new OutputStreamWriter(System.out, StandardCharsets.UTF_8), true);
        String line;
        while ((line = reader.readLine()) != null) {
            try {
                String[] parts = line.split("\\t", 2);
                String source = new String(Base64.getDecoder().decode(parts[0]), StandardCharsets.UTF_8);
                writer.println(complete(source, Integer.parseInt(parts[1])));
            } catch (Exception failure) {
                writer.println("[]");
            }
        }
    }
}
