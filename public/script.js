console.log("Script loaded");

async function fetchData() {
    try {
        const response = await fetch("/api/league");
        const data = await response.json();

        console.log(data);

        document.getElementById("output").textContent =
            JSON.stringify(data, null, 2);

    } catch (error) {
        console.error("Error:", error);
    }
}