/// <reference path="../typings/main.d.ts" />
namespace app {
    'use strict';

    interface IDraggableScope extends ng.IScope {
        draggable?: string;
    }

    interface IPosition {
        x: number;
        y: number;
    }

    export class DraggableDirective {
        private cursorPosition: IPosition;
        private offsetPosition: IPosition;

        private mouseMoveEventListener: JQuery;
        private mouseUpEventListener: JQuery;

        private element: JQuery;
        private handle: JQuery;

        constructor(
            $element: ng.IAugmentedJQuery,
            $scope: IDraggableScope,
            private $document: ng.IDocumentService
        ) {
            this.setCursorPosition(0, 0);
            this.setOffsetPosition(0, 0);

            this.element = $element.parent('.modal-content');

            this.element.css({
                position: 'relative'
            });

            if ($scope.draggable) {
                this.handle = angular.element($scope.draggable);
            } else {
                this.handle = this.element;
            }

            this.handle.css({
                cursor: 'move'
            });

            this.handle.on('mousedown', (event: JQueryEventObject) => this.beginDrag(event));
        }

        private beginDrag(event: JQueryEventObject): void {
            event.preventDefault();

            const x: number = event.pageX - this.offsetPosition.x;
            const y: number = event.pageY - this.offsetPosition.y;
            this.setCursorPosition(x, y);

            this.mouseMoveEventListener = this.$document.on('mousemove', (e: JQueryEventObject) => this.drag(e));
            this.mouseUpEventListener = this.$document.on('mouseup', (e: JQueryEventObject) => this.endDrag());
        }

        private drag(event: JQueryEventObject): void {
            const x: number = event.pageX - this.cursorPosition.x;
            const y: number = event.pageY - this.cursorPosition.y;

            this.setOffsetPosition(x, y);

            this.element.css({
                left: `${x}px`,
                top: `${y}px`
            });
        }

        private endDrag(): void {
            this.mouseMoveEventListener.off();
            this.mouseUpEventListener.off();
        }

        private setCursorPosition(x: number, y: number): void {
            this.cursorPosition = {
                x: x,
                y: y
            };
        }

        private setOffsetPosition(x: number, y: number): void {
            this.offsetPosition = {
                x: x,
                y: y
            };
        }
    }

    angular
        .module('app')
        .directive('draggable', () => {
            return {
                controller: DraggableDirective,
                restrict: 'A',
                scope: {
                    'draggable': '@'
                }
            };
        });
}
