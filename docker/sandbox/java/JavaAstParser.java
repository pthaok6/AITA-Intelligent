import java.nio.file.*;
import java.util.*;
import javax.tools.*;
import com.sun.source.tree.*;
import com.sun.source.util.*;

public class JavaAstParser {
  static String quote(String text) {
    StringBuilder result = new StringBuilder("\"");
    for (char value : text.toCharArray()) {
      switch (value) {
        case '"': result.append("\\\""); break;
        case '\\': result.append("\\\\"); break;
        case '\n': result.append("\\n"); break;
        case '\r': result.append("\\r"); break;
        case '\t': result.append("\\t"); break;
        default: if (value < 32) result.append(String.format("\\u%04x", (int)value)); else result.append(value);
      }
    }
    return result.append('"').toString();
  }
  public static void main(String[] args) throws Exception {
    Path root = Path.of("/work/src");
    List<Path> paths;
    try (var stream = Files.walk(root)) { paths = stream.filter(p -> p.toString().endsWith(".java")).sorted().toList(); }
    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    DiagnosticCollector<JavaFileObject> errors = new DiagnosticCollector<>();
    try (var manager = compiler.getStandardFileManager(errors, null, java.nio.charset.StandardCharsets.UTF_8)) {
      JavacTask task = (JavacTask)compiler.getTask(null, manager, errors, List.of("-proc:none"), null, manager.getJavaFileObjectsFromPaths(paths));
      var units = task.parse();
      SourcePositions positions = Trees.instance(task).getSourcePositions();
      List<String> files = new ArrayList<>();
      for (CompilationUnitTree unit : units) {
        List<String> tokens = new ArrayList<>();
        new TreeScanner<Void, Void>() {
          void emit(String text, Tree node) {
            long start = positions.getStartPosition(unit, node), end = positions.getEndPosition(unit, node);
            long line = start < 0 ? 1 : unit.getLineMap().getLineNumber(start);
            long endLine = end < 0 ? line : unit.getLineMap().getLineNumber(Math.max(start, end - 1));
            tokens.add("{\"value\":" + quote(text.length() > 160 ? text.substring(0,160) : text) + ",\"line\":" + line + ",\"endLine\":" + endLine + "}");
          }
          @Override public Void scan(Tree node, Void unused) {
            if (node == null) return null;
            emit(node.getKind().name() + "{", node);
            if (node instanceof IdentifierTree || node instanceof MemberSelectTree) emit("ID", node);
            if (node instanceof LiteralTree literal) emit("CONST:" + String.valueOf(literal.getValue()), node);
            super.scan(node, unused);
            emit("}", node);
            return null;
          }
        }.scan(unit, null);
        String name = root.relativize(Path.of(unit.getSourceFile().toUri())).toString().replace('\\','/');
        files.add("{\"path\":" + quote(name) + ",\"tokens\":[" + String.join(",", tokens) + "]}");
      }
      if (errors.getDiagnostics().stream().anyMatch(d -> d.getKind() == Diagnostic.Kind.ERROR)) {
        errors.getDiagnostics().forEach(System.err::println); System.exit(1);
      }
      System.out.println("{\"files\":[" + String.join(",", files) + "]}");
    }
  }
}
