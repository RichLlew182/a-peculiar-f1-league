console.log("Script loaded");

async function fetchData() {
    try {
        const response = await fetch("/api/league");
        const data = await response.json();

        document.getElementById("output").textContent =
            JSON.stringify(data, null, 2);

        displayLeagueData(data)

    } catch (error) {
        console.error("Error:", error);
    }
}

function displayLeagueData(data) {


    document.getElementById("output").innerHTML = '';
    document.getElementById("lastUpdated").textContent = 'Last League Update: ' + data.FeedTime.CESTTime;

    const teamName = decodeURIComponent(data.Value.leaderboard[0].team_name);

    const players = data.Value.leaderboard;

    players.forEach(player => {
        const playerName = decodeURIComponent(player.user_name);
        const teamName = decodeURIComponent(player.team_name);
        const points = player.cur_points;
        console.log(`Player: ${playerName}, Team: ${teamName}, Points: ${points}`);
        const card = document.createElement('div');
        card.className = 'card mb-5';
        card.innerHTML = `
            <div class="card-content">
                <h3 class="title is-4">${playerName}</h3>
                <h4 class="subtitle is-6">Team: ${teamName}</h4>
                <p>Points: ${points}</p>
            </div>
        `;
        document.getElementById("output").appendChild(card);
    })

    d

}

fetchData() 