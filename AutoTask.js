package com.autotask;

import java.sql.*;
import java.time.LocalDateTime;
import java.net.http.*;
import java.net.URI;
import com.fasterxml.jackson.databind.*;

/**
 * AutoTask.java
 * Java-based AI automation agent (GitHub-ready single file)
 */
public class AutoTask {

    private static final String DB_URL = "jdbc:sqlite:autotask.db";
    private final String apiKey;
    private final ObjectMapper mapper = new ObjectMapper();

    public AutoTask(String apiKey) {
        this.apiKey = apiKey;
        initDatabase();
    }

    private void initDatabase() {
        try (Connection conn = DriverManager.getConnection(DB_URL)) {
            Statement stmt = conn.createStatement();
            stmt.execute(
                "CREATE TABLE IF NOT EXISTS tasks (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "name TEXT," +
                "workflow TEXT," +
                "created_at TEXT," +
                "status TEXT)"
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public JsonNode parseNaturalLanguage(String command) throws Exception {
        String payload = "{\"model\":\"gpt-4\",\"messages\":[" +
                "{\"role\":\"system\",\"content\":\"Convert tasks into JSON workflows\"}," +
                "{\"role\":\"user\",\"content\":\"" + command + "\"}]}";

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.openai.com/v1/chat/completions"))
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload))
                .build();

        HttpClient client = HttpClient.newHttpClient();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        return mapper.readTree(response.body())
                .path("choices").get(0)
                .path("message").path("content");
    }

    public void executeWorkflow(JsonNode workflow) {
        System.out.println("Executing workflow: " + workflow.path("name").asText());
        for (JsonNode step : workflow.path("steps")) {
            System.out.println("→ " + step.path("type").asText() + " : " + step.path("action").asText());
        }
    }

    public void saveTask(JsonNode workflow) {
        try (Connection conn = DriverManager.getConnection(DB_URL)) {
            PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO tasks(name, workflow, created_at, status) VALUES(?,?,?,?)"
            );
            ps.setString(1, workflow.path("name").asText());
            ps.setString(2, workflow.toString());
            ps.setString(3, LocalDateTime.now().toString());
            ps.setString(4, "active");
            ps.executeUpdate();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void createTaskFromCommand(String command) {
        try {
            JsonNode workflow = parseNaturalLanguage(command);
            saveTask(workflow);
            executeWorkflow(workflow);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void main(String[] args) {
        String apiKey = System.getenv("OPENAI_API_KEY");
        AutoTask autoTask = new AutoTask(apiKey);

        autoTask.createTaskFromCommand(
            "Every Monday at 9am, open my bank website and download the statement"
        );
    }
}
