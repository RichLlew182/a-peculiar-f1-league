const f1URL = 'https://fantasy.formula1.com/feeds/leaderboard/privateleague/list_1_819704_0_1.json?buster=20260309150248'

function fetchData() {

    try {

        fetch(f1URL)
            .then(response => response.json(),)
            .then(console.log('Response received:', response))
            .then(data => {
                console.log(data);
            });

    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

fetchData()