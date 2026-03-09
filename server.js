import express from "express";

const app = express();
const PORT = 3000;

app.use(express.static("public"));

app.get("/api/drivers-and-constructors", async (req, res) => {
    try {
        const response = await fetch(
            "https://fantasy.formula1.com/feeds/v2/statistics/driverconstructors_4.json"
        );

        const data = await response.json();
        console.log("Fetched data from F1 API:", data);

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

app.get("/api/league", async (req, res) => {
    try {
        const response = await fetch(
            "https://fantasy.formula1.com/feeds/leaderboard/privateleague/list_1_819704_0_1.json"
        );

        const data = await response.json();
        console.log("Fetched data from F1 API:", data);

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch data" });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});