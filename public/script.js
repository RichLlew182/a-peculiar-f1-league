console.log("Script loaded");

async function fetchDriverConstructors() {
    try {
        const response = await fetch("/api/drivers-and-constructors");
        const data = await response.json();

        console.log("Data from /api/drivers-and-constructors:", data);

        displayDriverConstructorData(data);

    } catch (error) {
        console.error("Error:", error);
    }
}

async function fetchLeagueData() {
    try {
        const response = await fetch("/api/league");
        const data = await response.json();

        displayLeagueData(data)

    } catch (error) {
        console.error("Error:", error);
    }
}

function displayDriverConstructorData(data) {

    // console.log(data)

    const drivers = data.Data.driver;
    const constructors = data.Data.constructor;

    console.log({ drivers, constructors });

    const driverConstructorList = document.getElementById("driverConstructorList");

}

function displayLeagueData(data) {


    document.getElementById("leagueList").innerHTML = '';
    document.getElementById("lastUpdated").textContent = 'Last League Update: ' + data.FeedTime.CESTTime;

    const players = data.Value.leaderboard;

    console.log({ players });

    players.forEach(player => {
        const playerName = decodeURIComponent(player.user_name);
        const teamName = decodeURIComponent(player.team_name);
        const points = player.cur_points;
        const playerTeam = player.user_team;
        const card = document.createElement('div');
        card.className = 'card mb-5';
        card.innerHTML = `
            <div class="card-content is-flex is-flex-direction-row is-align-items-center is-gap-4">
            <figure class="image is-128x128">
            <img class="is-rounded" src="https://bulma.io/assets/images/placeholders/128x128.png" />
            </figure>
                <div>
                    <h3 class="title is-4">${playerName}</h3>
                    <h4 class="subtitle is-6">Team: ${teamName}</h4>
                    <p>Points: ${points}</p>
                    <p>Constructors: ${playerTeam[0]}, ${playerTeam[1]}</p>
                    <p>Drivers: ${playerTeam[2]}, ${playerTeam[3]}, ${playerTeam[4]}, ${playerTeam[5]}, ${playerTeam[6]}</p>

                </div>
            </div>
        `;
        document.getElementById("leagueList").appendChild(card);
    })

    d

}

fetchDriverConstructors();

fetchLeagueData() 