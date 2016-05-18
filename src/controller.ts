/// <reference path="../typings/main.d.ts" />
/// <reference path="modal.controller.ts" />
namespace app {
    'use strict';

    class Controller {
        constructor(private $uibModal: ng.ui.bootstrap.IModalService) {
            this.openModal();
        }

        openModal(): void {
            this.$uibModal.open({
                backdrop: false,
                controller: ModalController,
                controllerAs: 'modal',
                templateUrl: 'modal.html'
            });
        }
    }

    angular.module('app').controller('Controller', Controller);
}
