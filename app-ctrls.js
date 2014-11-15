var app = angular.module('app');

app.controller('MainCtrl', function($scope, $location, Store, actionCreator) {
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

  $scope.$watch('store.myFace', function (newVal) {
    // @todo: a better way?
    if (newVal) $location.url('results');
  })
});

app.controller('HomeCtrl', function($scope, Store, actionCreator) {

});

app.controller('TestCtrl', function($scope, Store, actionCreator) {

});

app.controller('ResultsCtrl', function($scope, Store, actionCreator) {

});