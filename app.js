var app = angular.module('plunker', ['ngStorage']);

app.constant('Flux', DeLorean.Flux);

app.controller('MainCtrl', function($scope, Store, actionCreator, Dispatcher) {
  var store = Store.store;
  $scope.store = store;

  actionCreator.initFaces();

  $scope.clickPhoto = function(photo) {
    actionCreator.selectPhoto(photo);
  };

  $scope.pct = function() {
    return ~~(100*store.totalVoteCount / store.maxVotes) + '%';
  };

  Store.onChange(function() {
    // store triggered update
  });
});

app.filter('jpg', function() {
  return function(f) {
    return f.replace('2.jpg','3.jpg');
  }
});

app.factory('Store', function (Flux) {
  var goodTags = ['happy','sad','angry','confused','glasses','troll','cute','child','creepy','stoned','stupid','alone','girl','man','scared','cry','lol','crazy','fuck','celebrity','smile','japanese','cool','clean','sexy'];
  var Store = Flux.createStore({
    data: null,
    faceData: null,
    faceTagHash: null,
    topTags: goodTags,
    photos: null,
    tags: null,
    photosPerRound: 4,
    totalVoteCount: 0,
    //maxTags: goodTags.length,
    maxVotes: 20,
    myFace: null,
    photosPerTag: 20,
    randPhotoChoices: null,
    choices: null,

    setData: function (data) {
      this.data = data;
      this.emit('change');
    },

    chooseRandomTags: function() {
      this.choices = this.randPhotoChoices.splice(0, this.photosPerRound);
      this.tags = _.pluck(this.choices, 'tag');
    },

    initFacesSuccess: function(data) {
      console.log('faceData:',data);
      faceData = angular.copy(data);
      var faceTagHash = {};

      // map tags to faces, used as a quick-lookup method
      _.each(faceData, function(v,i) {
        if (v.tags) {
          var tags = v.tags.split(',');
          _.each(tags, function(w) {
            if (w.match(/^[a-z][a-z][a-z]+$/)) {
              if (faceTagHash[w]) faceTagHash[w].push(v);
              else faceTagHash[w] = [v];
            }
          });
        }
      });

      // add topTags to each face
      var topTags = this.topTags;
      _.each(topTags, function (t) {
        _.each(faceTagHash[t], function (face) {
          if (face.topTags) face.topTags.push(t);
          else face.topTags = [t];
        });
      });

      // build up indexes for all top tags
      var photosPerTag = this.photosPerTag;
      var topTagRandIdxs = _.map(topTags, function (t) {
        return _(_.range(photosPerTag))
          .shuffle()
          .map(function(idx) { return {tag: t, idx: idx } })
          .value();
      });

      // use random indexes from previous step to build
      // a list of well-distributed, non-repeated random choices
      var randPhotoChoices = [];
      for (var i=0; i<photosPerTag; i++) {
        var choices = []
        _.each(topTagRandIdxs, function(idxs) {
          choices.push(idxs.pop());
        });
        console.log('choices: ',choices);
        randPhotoChoices = randPhotoChoices.concat(_.shuffle(choices));
      }

      this.randPhotoChoices = randPhotoChoices;
      this.faceTagHash = faceTagHash;
      this.chooseRandomTags();

      this.emit('change');
    },

    loadPhotosSuccess: function(photos) {
      var self = this;
      this.photos = photos.map(function(p) {
        return p[self.choices.pop().idx];
      });

      console.log("photos loaded", this.photos);
      this.emit('change');
    },

    selectPhoto: function(photo) {
      // increment vote count
      _.each(this.faceTagHash[photo.tag], function (face) {
        face.voteCount = (face.voteCount || 0) + 1/(face.topTags.length);
      });
      this.totalVoteCount++;
      this.chooseRandomTags();

      // if maxVotes reached, determine winner
      if (this.totalVoteCount >= this.maxVotes) {
        this.myFace = _.max(faceData, 'voteCount');
        console.log('myFace:',this.myFace);
      }
      this.emit('change');
    },
    actions: {
      'initFacesSuccess': 'initFacesSuccess',
      'loadPhotosSuccess': 'loadPhotosSuccess',
      'selectPhoto': 'selectPhoto'
    }
  });
  return new Store();
});

app.factory('Dispatcher', function (Flux, Store) {
  return Flux.createDispatcher({
    getStores: function () {
      return {Store: Store};
    }
  });
});

app.factory('localCache', function($localStorage) {
  return $localStorage.$default({
    allFaces: null,
    photos: {}
  });
});

app.factory('actionCreator', function (Flux, Dispatcher, $http, Store, $rootScope, localCache) {
  var searchParams = {
    only: 'people,performing arts',
    //only: 'abstract',
    sort: '_score',
    nsfw: false,
    page: 1
  };

  // add tag to all photos in array
  function annotatePhotos(photos, tag) {
    return _.map(photos, function(photo) {
      return { photo: photo, tag: tag };
    });
  }

  // search 500px using a search term
  function photoSearch(term, cb) {
    _500px.api('/photos/search', _.extend(searchParams, {term:term}), function(r) {
      cb(r.error || null, annotatePhotos(r.data.photos,term));
    });
  }

  function loadPhotos() {
    console.log('loadPhotos...', Store.store.tags);
    var cachedPhotos = [];
    var tags = [];

    // pull from local storage
    _.each(Store.store.tags, function (tag) {
      if (localCache.photos[tag]) {
        cachedPhotos.push(angular.copy(localCache.photos[tag]));
      } else {
        tags.push(tag);
      }
    });

    // load anything that wasn't found in local storage and then combine w/localStorage result
    async.map(tags, photoSearch, function (e,r) {
      console.log('tags:',tags);
      _.each(r, function(v) { localCache.photos[v[0].tag] = angular.copy(v) });  // save to cache
      Dispatcher.dispatch('loadPhotosSuccess', r.concat(cachedPhotos));
      $rootScope.$apply();
    });
  }

  return {
    initFaces: function() {
      var url = 'http://alltheragefaces.com/api/all/faces';

      // load face data from cache if possible, otherwise via the api
      // then load photos
      if (localCache.allFaces) {
        console.log('(loading face data from cache)');
        Dispatcher.dispatch('initFacesSuccess', localCache.allFaces).then(loadPhotos);
      } else {
        $http.get(url)
          .success(function(data) {
            localCache.allFaces = data;
            Dispatcher.dispatch('initFacesSuccess', data).then(loadPhotos);
          })
          .error(function(data) {
            console.log("error:", data);
            Dispatcher.dispatch('initFacesError', data);
          });
      }
    },
    selectPhoto: function(photo) {
      Dispatcher.dispatch('selectPhoto', photo).then(loadPhotos);
    },
  };
});

app.run(function() {
  _500px.init({
    sdk_key: '86ed1bc79f5e6c09f9ffc64ba32210e4c9ca18ae'
  });
});




