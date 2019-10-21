function send(event) {
    var token = '{{csrf}}';
    //
    if (event.key == "Enter") {
        var value = encodeURI(document.getElementById('url').value);
        fetch('/', {
            method: 'POST',
            body: value,
            credentials: 'include',
            headers: { 'csrf-token': token }
        }).then(
            function (response) {
                if (response.status !== 200) {
                    alert('Looks like there was a problem. Status Code: ' + response.status);
                    return;
                }
            }
        ).catch(function (err) {
            alert(err);
        });
    }
}