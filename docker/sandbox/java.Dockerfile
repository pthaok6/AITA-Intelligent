FROM eclipse-temurin:17-jdk-jammy
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
COPY java/JavaAstParser.java /opt/aita/java/JavaAstParser.java
RUN javac -d /opt/aita/java /opt/aita/java/JavaAstParser.java
COPY common /opt/aita
USER 1000:1000
WORKDIR /work
ENV HOME=/tmp
