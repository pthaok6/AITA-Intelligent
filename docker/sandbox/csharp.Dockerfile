FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim AS parser
WORKDIR /build
COPY roslyn ./
RUN dotnet publish -c Release -o /parser --nologo

FROM mcr.microsoft.com/dotnet/sdk:8.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
COPY --from=parser /parser /opt/aita/roslyn
COPY common /opt/aita
USER 1000:1000
WORKDIR /work
ENV HOME=/tmp DOTNET_CLI_HOME=/tmp DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_EnableDiagnostics=0
