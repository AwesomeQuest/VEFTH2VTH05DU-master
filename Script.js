        //sets date input to today by default
        Date.prototype.toDateInputValue = (function () {
            var local = new Date(this);
            local.setMinutes(this.getMinutes() - this.getTimezoneOffset());
            return local.toJSON().slice(0, 10);
        });
        document.getElementById('date').value = new Date().toDateInputValue();

        google.load('visualization', '1', { packages: ['columnchart'] });


        fetch("https://apis.is/weather/forecasts/is?stations=1")
            .then((response) => {
                if (response.status !== 200) {
                    console.log("Fuck" + response.status.toString());
                    //stop everything
                    return;
                }

                //get the data, put it in a global, forget about it, start the app
                response.json().then((data) => {
                    let thing = data;

                    console.log(data);

                });
            })




        function initMap() {
            // these are all the markers on the map, used only to 
            let markersArray = [];

            let directionsService = new google.maps.DirectionsService();

            let map = new google.maps.Map(document.getElementById("map"), {
                zoom: 15,
                center: { lat: 64.147582, lng: -21.9352 },
                mapTypeId: "terrain",
                disableDoubleClickZoom: true
            });
            google.maps.event.addListener(map, 'click', function (event) {
                var marker = new google.maps.Marker({
                    position: event.latLng,
                    map: map,
                    title: event.latLng.lat() + ', ' + event.latLng.lng()
                });
                markersArray.push(marker);

                if (markersArray.length >= 2) {
                    map.clearOverlays();
                } else if (markersArray.length === 1) {
                    plotRangeCircleBkFrth(new google.maps.LatLng(event.latLng));
                }
            });


            //creates the function clearOverlays, 
            //used so no more than two markers can be visable at a time.

            google.maps.Map.prototype.clearOverlays = function () {
                for (var i = 0; i < markersArray.length; i++) {
                    markersArray[i].setMap(null);
                }
                markersArray.length = 0;
            }


            let Mylocation = { lat: 64, lng: -21 };
            navigator.geolocation.getCurrentPosition((pos) => {
                Mylocation = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                map.setCenter(Mylocation);
                plotRangeCircleBkFrth(Mylocation);
            });


            var elevator = new google.maps.ElevationService;



            function renderDirections(result) {
                let directionsRenderer = new google.maps.DirectionsRenderer();
                directionsRenderer.setMap(map);
                directionsRenderer.setDirections(result);
            }

            function requestDirections(start, end) {
                directionsService.route({
                    origin: start,
                    destination: end,
                    travelMode: google.maps.DirectionsTravelMode.WALKING
                }, function (result) {
                    renderDirections(result);

                    let firstStepStep = result.routes[0].legs[0].steps;
                    console.log(result);



                    let truePath = [];

                    for (let i = 0; i < firstStepStep.length; i++) {
                        const path = firstStepStep[i].path;

                        path.forEach(loc => {
                            truePath.push({ lat: loc.lat(), lng: loc.lng() })
                        });

                    }

                    elevator.getElevationAlongPath({
                        'path': truePath,
                        'samples': 50
                    }, (elevations, status) => {
                        plotElevation(elevations, status);
                    });


                });
            }

            function plotElevation(elevations, status) {
                var chartDiv = document.getElementById('elevation_chart');
                if (status !== 'OK') {
                    // Show the error code inside the chartDiv.
                    chartDiv.innerHTML = 'Cannot show elevation: request failed because ' +
                        status;
                    return;
                }
                // Create a new chart in the elevation_chart DIV.
                var chart = new google.visualization.ColumnChart(chartDiv);

                // Extract the data from which to populate the chart.
                // Because the samples are equidistant, the 'Sample'
                // column here does double duty as distance along the
                // X axis.
                var data = new google.visualization.DataTable();
                data.addColumn('string', 'Sample');
                data.addColumn('number', 'Elevation');
                for (var i = 0; i < elevations.length; i++) {
                    data.addRow(['', elevations[i].elevation]);
                }

                // Draw the chart using the data within its DIV.
                chart.draw(data, {
                    height: 150,
                    legend: 'none',
                    titleY: 'Elevation (m)'
                });
            }

            //this, given a centre to start from, plots the predicted back and forth range of the rider
            //effortLvl is a multiplier for the range, given in percentage. 0 means no effort, 100 doubles max range
            function plotRangeCircleBkFrth(centreLatLng) {

                let batWattage = document.getElementById("wattage").value;
                let batVoltage = document.getElementById("voltage").value;
                let batAmpHr = document.getElementById("amphr").value;
                let effortLvl = document.getElementById("effortLvl").value;
                let speedUpHill = document.getElementById("speedUpHill").value;
                let dateGiven = document.getElementById("date").value;

                //calc the max run time of the battery in seconds
                let maxRunTimeSec = (batAmpHr / (batWattage / batVoltage)) * 60 * 60;

                let maxUpHillDistMetre = maxRunTimeSec * ((speedUpHill / 60 / 60) * 1000);
                //this converts the distance given in mertes to the equivilent in earth degrees.
                //apperantly, 111 111 metres is approximetly equall to 1 degree of lattitude, funny
                let maxUpHillDist = maxUpHillDistMetre / 111111;

                let maxDistPoints = [];

                let pointsOnCircle = 2;

                for (let i = 0; i < pointsOnCircle; i++) {
                    let circlePoint = {
                        lat: centreLatLng.lat + maxUpHillDist / 2 * (effortLvl / 100 + 1) * Math.cos(Math.PI / pointsOnCircle * i),
                        lng: centreLatLng.lng + maxUpHillDist / 2 * (effortLvl / 100 + 1) * Math.sin(Math.PI / pointsOnCircle * i)
                    }

                    maxDistPoints.push(circlePoint);

                }

                maxDistPoints.forEach((point, index) => {

                    for (let i = 0; i < pointsOnCircle; i++) {


                        directionsService.route({
                            origin: centreLatLng,
                            destination: point,
                            travelMode: google.maps.DirectionsTravelMode.WALKING
                        }, (result, status) => {
                            let delayFact = 0;
                            if (status == google.maps.DirectionsStatus.OK) {

                                let steps = result.routes[0].legs[0].steps;

                                let truePath = [];

                                steps.forEach(path => {
                                    path.forEach(loc => {
                                        truePath.push({ lat: loc.lat(), lng: loc.lng() });
                                    });
                                });

                                elevator.getElevationAlongPath({
                                    'path': truePath,
                                    'samples': result.routes[0].legs[0].distance.value
                                }, (elevations, status) => {
                                    let maxDist = maxUpHillDistMetre;
                                    for (let i = 1; i < elevations.length; i++) {
                                        if (elevations[i].elevation > elevations[i - 1].elevation + 0.1) {
                                            maxDist = maxDist - 1;
                                        }
                                    }


                                    if (maxDist < -100 || maxDist > 100) {
                                        let modMaxUpHillDist = (maxUpHillDistMetre + maxDist) / 111111;


                                        point = new google.maps.LatLng(
                                            centreLatLng.lat + modMaxUpHillDist / 2 * (effortLvl / 100 + 1) * Math.cos(Math.PI / pointsOnCircle * index),
                                            centreLatLng.lng + modMaxUpHillDist / 2 * (effortLvl / 100 + 1) * Math.sin(Math.PI / pointsOnCircle * index)
                                        )
                                        return;
                                    }
                                });
                            } else if (status == google.maps.DirectionsStatus.OVER_QUERY_LIMIT) {

                                delayFact++;

                                setTimeout(() => {
                                    let steps = result.routes[0].legs[0].steps;

                                    let truePath = [];

                                    steps.forEach(path => {
                                        path.forEach(loc => {
                                            truePath.push({ lat: loc.lat(), lng: loc.lng() });
                                        });
                                    });

                                    elevator.getElevationAlongPath({
                                        'path': truePath,
                                        'samples': result.routes[0].legs[0].distance.value
                                    }, (elevations, status) => {
                                        let maxDist = maxUpHillDistMetre;
                                        for (let i = 1; i < elevations.length; i++) {
                                            if (elevations[i].elevation > elevations[i - 1].elevation + 0.1) {
                                                maxDist = maxDist - 1;
                                            }
                                        }


                                        if (maxDist < -100 || maxDist > 100) {
                                            let modMaxUpHillDist = (maxUpHillDistMetre + maxDist) / 111111;


                                            point = new google.maps.LatLng(
                                                centreLatLng.lat + modMaxUpHillDist / 2 * (effortLvl / 100 + 1) * Math.cos(Math.PI / pointsOnCircle * index),
                                                centreLatLng.lng + modMaxUpHillDist / 2 * (effortLvl / 100 + 1) * Math.sin(Math.PI / pointsOnCircle * index)
                                            )
                                            return;
                                        }
                                    });
                                   }, delayFact * 1000);
                                }
                        });

                    }

                    var marker = new google.maps.Marker({
                        position: point,
                        map: map,
                        title: point.toString()
                    });

                    requestDirections(centreLatLng, point);
                    console.log("made " + index + " requests");
                });


            }




            //requestDirections("Eiðistorg, Reykjavík", "Frostaskjól 2, 107 Reykjavík");





        }
