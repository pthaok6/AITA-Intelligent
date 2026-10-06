using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using System.Text.Json;

var files = new List<object>();
var root = "/work/src";
foreach (var file in Directory.EnumerateFiles(root, "*.cs", SearchOption.AllDirectories).Order())
{
    var tree = CSharpSyntaxTree.ParseText(File.ReadAllText(file), new CSharpParseOptions(LanguageVersion.CSharp12));
    var errors = tree.GetDiagnostics().Where(d => d.Severity == DiagnosticSeverity.Error).ToArray();
    if (errors.Length > 0) { Console.Error.WriteLine(string.Join("\n", errors.Select(e => e.ToString()))); Environment.Exit(1); }
    var tokens = new List<object>();
    void Emit(string value, TextSpanWrapper location)
    {
        var span = tree.GetLineSpan(location.Span);
        tokens.Add(new { value, line = span.StartLinePosition.Line + 1, endLine = span.EndLinePosition.Line + 1 });
    }
    void Walk(SyntaxNode node)
    {
        Emit(node.Kind() + "{", new(node.Span));
        foreach (var child in node.ChildNodesAndTokens())
        {
            if (child.IsNode) Walk(child.AsNode()!);
            else
            {
                var token = child.AsToken();
                var value = token.IsKind(SyntaxKind.IdentifierToken) ? "ID" : token.Kind() + ":" + token.ValueText;
                Emit(value.Length > 160 ? value[..160] : value, new(token.Span));
            }
        }
        Emit("}", new(node.Span));
    }
    Walk(tree.GetRoot());
    files.Add(new { path = Path.GetRelativePath(root, file).Replace('\\', '/'), tokens });
}
Console.WriteLine(JsonSerializer.Serialize(new { files }));
record TextSpanWrapper(Microsoft.CodeAnalysis.Text.TextSpan Span);
