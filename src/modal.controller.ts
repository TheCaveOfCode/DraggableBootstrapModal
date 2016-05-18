/// <reference path="../typings/main.d.ts" />
namespace app {
    'use strict';

    export class ModalController {
        constructor(private $uibModalInstance: ng.ui.bootstrap.IModalServiceInstance) {}

        ok(): void {
            this.$uibModalInstance.close();
        }

        cancel(): void {
            this.$uibModalInstance.dismiss();
        }
    }
}
