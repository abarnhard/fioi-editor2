'use strict';
module.exports = function (m) {

/**
This directive inserts the editor component.

Each instance of the editor component is bound to a named group in the
storage service.

The user can select one of the tabs maintained by the storage service,
add a new tab, remove a tab, and rename a tab.

When a tab is selected, the editor uses a buffer directive to display the
sequence of buffers held in the tab side-by-side.

The directive supplies its API object to the parent controller in a variable
named 'api' when evaluating the directive's on-init attribute.

The API includes function to:
- start and stop the recording mode
- retrieve the last recorded sequence of timestamped events
- …

*/
m.directive('fioiEditor2', editorDirective);
function editorDirective () {
   return {
      restrict: 'E',
      scope: {
         onInit: '&',
         tabset: '@'
      },
      template: require('./editor.jade'),
      controllerAs: 'vm',
      bindToController: true,
      replace: true,
      controller: EditorController,
      link: function (scope, iElement, iAttrs, controller) {
         scope.$on('$destroy', function () {
            scope.vm.cleanup();
         });
      }
   };
}

EditorController.$inject = ['$rootScope', 'FioiEditor2Tabsets']
function EditorController ($rootScope, tabsets) {

   var tabset = tabsets.get(this.tabset);
   var controller = this;

   var api = {};
   api.placeholder = function () {
      alert('placeholder');
   };
   api.trigger = function (event) {
      if (event === 'tabs-changed')
         return load();
   };

   this.addTab = function () {
      var tab = tabset.addTab();
      tab.addBuffer('');
      this.selectTab(tab);
   }.bind(this);

   this.closeTab = function (tab) {
      console.log('closeTab', tab.name);
      tabset.removeTab(tab.name);
   };

   this.selectTab = function (tab) {
      tabset.setActiveTab(tab.name);
   };

   // Initialize controller data and reload it on 'changed' event.
   onTabsetChanged();
   var unhookers = [
      $rootScope.$on('fioi-editor2_tabset-'+this.tabset+'_changed', onTabsetChanged)
   ];
   this.cleanup = function () {
      _.each(unhookers, function (func) { func(); });
   };

   // Pass the editor component's API to the enclosing controller.
   if (typeof this.onInit === 'function')
      this.onInit({api: api});

   //
   // Private function
   //

   // Load state from the tabs service.
   function onTabsetChanged () {
      controller.tabs = tabset.getTabs();
      controller.tab = tabset.getActiveTab();
   }

}

};