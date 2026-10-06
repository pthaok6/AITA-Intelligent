"""Trusted compiler launcher. Submission build/project scripts are never executed."""
import pathlib
import py_compile
import subprocess
import sys

language = sys.argv[1]
root = pathlib.Path('/work/src')
out = pathlib.Path('/work/out')
out.mkdir(exist_ok=True)
if language == 'PYTHON':
    try:
        for source in sorted(root.rglob('*.py')):
            py_compile.compile(str(source), cfile=str(out / (str(len(list(out.iterdir()))) + '.pyc')), doraise=True)
    except py_compile.PyCompileError as error:
        print(error, file=sys.stderr)
        sys.exit(1)
elif language == 'JAVA':
    sources = [str(source) for source in sorted(root.rglob('*.java'))]
    sys.exit(subprocess.call(['javac', '-J-Xmx256m', '-proc:none', '-encoding', 'UTF-8', '-d', str(out)] + sources))
elif language == 'CSHARP':
    pathlib.Path('/work/Submission.csproj').write_text('''<Project Sdk="Microsoft.NET.Sdk">
      <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net8.0</TargetFramework>
      <EnableDefaultCompileItems>false</EnableDefaultCompileItems><ImplicitUsings>enable</ImplicitUsings>
      <AssemblyName>Submission</AssemblyName><UseAppHost>false</UseAppHost><NuGetAudit>false</NuGetAudit>
      <EnableNETAnalyzers>false</EnableNETAnalyzers><RunAnalyzers>false</RunAnalyzers></PropertyGroup>
      <ItemGroup><Compile Include="/work/src/**/*.cs" /></ItemGroup></Project>''')
    pathlib.Path('/work/NuGet.Config').write_text('<configuration><packageSources><clear /></packageSources></configuration>')
    sys.exit(subprocess.call(['dotnet', 'build', '/work/Submission.csproj', '-c', 'Release', '-o', str(out),
        '--nologo', '--disable-build-servers', '-p:UseSharedCompilation=false', '-p:NuGetAudit=false']))
else:
    print('Unsupported language', file=sys.stderr)
    sys.exit(2)
