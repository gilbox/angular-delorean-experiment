var app = angular.module('app');

app.controller('MainCtrl', function($scope, $location, appStore, actionCreator) {
  var store = appStore.store;
  $scope.store = store;

  actionCreator.initFaces();

  $scope.clickPhoto = function(photo) {
    actionCreator.selectPhoto(photo);
  };

  $scope.pct = function() {
    return ~~(100*store.totalVoteCount / store.maxVotes) + '%';
  };

  appStore.onChange(function() {
    // store triggered update
  });

  $scope.$watch('store.myFace', function (newVal) {
    // @todo: a better way?
    if (newVal) $location.url('results');
  })
});

app.controller('HomeCtrl', function($scope, appStore, actionCreator) {

});

app.controller('TestCtrl', function($scope, appStore, actionCreator) {

});

app.controller('ResultsCtrl', function($scope, appStore, actionCreator) {

});