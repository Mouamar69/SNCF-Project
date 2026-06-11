angular.module("sncfApp", [])

.controller("MainCtrl", ["$scope", "$http", "$timeout", function ($scope, $http, $timeout) {

  $scope.cities = ["Paris", "Lyon", "Bordeaux", "Lille", "Marseille", "Nantes"];
  $scope.from = "Paris";
  $scope.co2Max = 1.5;
  $scope.hoursMax = 3;
  $scope.destinations = [];
  $scope.selectedDest = null;
  $scope.loading = false;
  $scope.errorMsg = "";
  $scope.searched = false;
  $scope.userPrompt = "";
  $scope.aiNarrative = {};
  $scope.aiLoading = {};
  $scope.aiExplanation = "";

  // Chatbot
  $scope.chatOpen = false;
  $scope.chatMessages = [];
  $scope.chatInput = "";
  $scope.chatLoading = false;

  $scope.toggleChat = function () {
    $scope.chatOpen = !$scope.chatOpen;
    if ($scope.chatOpen && $scope.chatMessages.length === 0) {
      $scope.chatMessages.push({
        role: "assistant",
        content: "Bonjour !! Vous partez où ce week-end ? Dites-moi ce qui vous tente la mer, la montagne, une marche, une randonnée et je regarde ce qu'on a pour vous parmi les destinations disponibles."
      });
    }
    if ($scope.chatOpen) {
      $timeout(function () {
        var el = document.getElementById("chat-messages");
        if (el) el.scrollTop = el.scrollHeight;
      }, 100);
    }
  };

  $scope.sendChat = function () {
    var input = ($scope.chatInput || "").trim();
    if (!input || $scope.chatLoading) return;

    $scope.chatMessages.push({ role: "user", content: input });
    $scope.chatInput = "";
    $scope.chatLoading = true;

    $timeout(function () {
      var el = document.getElementById("chat-messages");
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);

    $http.post("/api/chat", {
      messages: $scope.chatMessages.map(function (m) {
        return { role: m.role, content: m.content };
      }),
      context: {
        from: $scope.from,
        destinations: $scope.destinations
      }
    }).then(function (res) {
      $scope.chatLoading = false;
      if (res.data.reply) {
        $scope.chatMessages.push({ role: "assistant", content: res.data.reply });
      }
      $timeout(function () {
        var el = document.getElementById("chat-messages");
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    }).catch(function () {
      $scope.chatLoading = false;
      $scope.chatMessages.push({ role: "assistant", content: "Désolé, une erreur s'est produite. Réessayez dans un instant." });
      $timeout(function () {
        var el = document.getElementById("chat-messages");
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    });
  };

  var map = null;
  var markers = [];
  var fromMarker = null;

  function co2Color(co2) {
    if (co2 < 0.3) return "#27ae60";
    if (co2 < 0.6) return "#2ecc71";
    if (co2 < 1.0) return "#f39c12";
    if (co2 < 1.5) return "#e67e22";
    return "#e74c3c";
  }

  function co2Label(co2) {
    if (co2 < 0.3) return "Très faible";
    if (co2 < 0.6) return "Faible";
    if (co2 < 1.0) return "Modéré";
    if (co2 < 1.5) return "Élevé";
    return "Très élevé";
  }

  $scope.co2Color = co2Color;
  $scope.co2Label = co2Label;

  $scope.formatDuration = function (min) {
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h === 0) return m + " min";
    if (m === 0) return h + "h";
    return h + "h" + (m < 10 ? "0" : "") + m;
  };

  $scope.formatHoursMax = function (h) {
    var hFloat = parseFloat(h);
    var hInt = Math.floor(hFloat);
    var m = Math.round((hFloat - hInt) * 60);
    if (m === 0) return hInt + "h";
    return hInt + "h" + (m < 10 ? "0" : "") + m;
  };

  $scope.formatCo2 = function (v) {
    return parseFloat(parseFloat(v).toFixed(1));
  };

  function initMap(fromCoords) {
    var center = fromCoords ? [fromCoords.lat, fromCoords.lng] : [46.5, 2.5];
    var zoom = fromCoords ? 6 : 6;

    if (!map) {
      map = L.map("map", { zoomControl: true }).setView(center, zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);
    } else {
      map.setView(center, zoom);
    }
  }

  function updateMap(fromCoords, destinations) {
    initMap(fromCoords);

    markers.forEach(function (m) { map.removeLayer(m); });
    markers = [];
    if (fromMarker) { map.removeLayer(fromMarker); fromMarker = null; }

    if (fromCoords) {
      fromMarker = L.circleMarker([fromCoords.lat, fromCoords.lng], {
        radius: 10,
        fillColor: "#c8102e",
        color: "#fff",
        weight: 3,
        fillOpacity: 1
      }).addTo(map);
      fromMarker.bindTooltip("<b>" + $scope.from + "</b><br>Ville de départ", { permanent: false });
    }

    destinations.forEach(function (dest) {
      var color = co2Color(dest.co2);
      var marker = L.circleMarker([dest.lat, dest.lng], {
        radius: 11,
        fillColor: color,
        color: "#fff",
        weight: 2,
        fillOpacity: 0.9
      });

      var poiHtml = dest.poi.map(function (p) {
        return "<div class='popup-poi'><b>" + p.name + "</b> <span class='popup-dist'> " + p.dist + "</span></div>";
      }).join("");

      marker.bindPopup(
        "<div class='popup-header'><b>" + dest.name + "</b></div>" +
        "<div class='popup-meta'>" +
          "<span class='popup-co2' style='color:" + color + "'> " + dest.co2 + " kg CO₂</span>" +
          " &nbsp;" + $scope.formatDuration(dest.duration) +
        "</div>" +
        "<p class='popup-desc'>" + dest.description + "</p>" +
        "<div class='popup-poi-list'>" + poiHtml + "</div>",
        { maxWidth: 280 }
      );

      marker.on("click", function () {
        $scope.$apply(function () {
          $scope.selectedDest = dest;
        });
        var cards = document.querySelectorAll(".dest-card");
        cards.forEach(function (c) { c.classList.remove("active"); });
        var target = document.getElementById("card-" + dest.id);
        if (target) {
          target.classList.add("active");
          target.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });

      marker.addTo(map);
      markers.push(marker);
    });

    if (destinations.length > 0 && fromCoords) {
      var latlngs = destinations.map(function (d) { return [d.lat, d.lng]; });
      latlngs.push([fromCoords.lat, fromCoords.lng]);
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    }
  }

  $scope.search = function () {
    $scope.loading = true;
    $scope.errorMsg = "";
    $scope.selectedDest = null;
    $scope.searched = true;
    $scope.aiNarrative = {};
    $scope.aiLoading = {};

    $http.get("/api/destinations", {
      params: {
        from: $scope.from,
        co2_max: parseFloat(parseFloat($scope.co2Max).toFixed(1)),
        hours_max: parseFloat($scope.hoursMax)
      }
    }).then(function (res) {
      $scope.destinations = res.data.destinations;
      $scope.loading = false;

      if ($scope.destinations.length === 0) {
        $scope.errorMsg = "Aucune destination trouvée. Essayez d'augmenter le budget CO₂ ou la durée.";
      }

      $timeout(function () {
        updateMap(res.data.fromCoords, res.data.destinations);
        if (map) map.invalidateSize();
        var sidebar = document.querySelector(".dest-cards");
        if (sidebar) sidebar.scrollTop = 0;
      }, 50);

    }).catch(function () {
      $scope.errorMsg = "Erreur lors de la recherche. Vérifiez que le serveur tourne.";
      $scope.loading = false;
    });
  };

  $scope.selectCard = function (dest) {
    $scope.selectedDest = dest;
    markers.forEach(function (m, i) {
      if ($scope.destinations[i] && $scope.destinations[i].id === dest.id) {
        m.openPopup();
        map.panTo([dest.lat, dest.lng]);
      }
    });

    if (!$scope.aiNarrative[dest.id] && !$scope.aiLoading[dest.id]) {
      $scope.aiLoading[dest.id] = true;
      $http.post("/api/ai-narrative", {
        from: $scope.from,
        destination: dest
      }).then(function (res) {
        $scope.aiLoading[dest.id] = false;
        if (res.data.description) {
          $scope.aiNarrative[dest.id] = res.data.description;
        }
      }).catch(function () {
        $scope.aiLoading[dest.id] = false;
      });
    }
  };

  $scope.co2Label = function (co2) {
    if (co2 < 0.3) return "Très faible";
    if (co2 < 0.6) return "Faible";
    if (co2 < 1.0) return "Modéré";
    if (co2 < 1.5) return "Élevé";
    return "Très élevé";
  };

  $timeout(function () {
    $scope.search();
  }, 100);
}]);
