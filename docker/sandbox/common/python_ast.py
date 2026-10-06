"""Parse only: student code is never imported or evaluated."""
import ast
import json
import pathlib
import sys

root = pathlib.Path('/work/src')
results = []
for source in sorted(root.rglob('*.py')):
    tree = ast.parse(source.read_text(encoding='utf-8-sig'), filename=source.relative_to(root).as_posix())
    tokens = []
    def emit(value, node):
        tokens.append({'value': value, 'line': max(1, getattr(node, 'lineno', 1)),
                       'endLine': max(1, getattr(node, 'end_lineno', None) or getattr(node, 'lineno', 1))})
    def visit(node):
        if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            return  # Docstrings do not contribute fingerprints.
        emit(type(node).__name__ + '{', node)
        if isinstance(node, ast.Constant):
            value = repr(node.value)
            emit('CONST:' + type(node.value).__name__ + ':' + value[:128], node)
        for field, value in ast.iter_fields(node):
            if isinstance(value, ast.AST):
                visit(value)
            elif isinstance(value, list):
                for child in value:
                    if isinstance(child, ast.AST):
                        visit(child)
            elif field in ('id', 'arg', 'name', 'attr', 'asname') and value is not None:
                emit('ID', node)
        emit('}', node)
    visit(tree)
    results.append({'path': source.relative_to(root).as_posix(), 'tokens': tokens})
print(json.dumps({'files': results}, ensure_ascii=False))
