FROM curlimages/curl:8.9.1
WORKDIR /app
COPY debezium/ debezium/
COPY register-connector.sh .
USER root
RUN chmod +x register-connector.sh
ENTRYPOINT ["./register-connector.sh"]
