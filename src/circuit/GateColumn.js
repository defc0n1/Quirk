import DetailedError from "src/base/DetailedError.js"
import Gate from "src/circuit/Gate.js"
import Gates from "src/ui/Gates.js"
import Matrix from "src/math/Matrix.js"
import Controls from "src/circuit/Controls.js"
import {seq, Seq} from "src/base/Seq.js"
import Util from "src/base/Util.js"

/**
 * A column of gates in a circuit with many qubits.
 */
class GateColumn {
    /**
     * A column of gates in a circuit with many qubits.
     *
     * @param {!Array.<null|!Gate>} gates The list of gates to apply to each wire, with the i'th gate applying to the i'th wire.
     * Wires without a gate in this column should use null instead.
     */
    constructor(gates) {
        /** @type {!Array.<null|!Gate>} */
        this.gates = gates;
    }

    /**
     * @param {!GateColumn|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (this === other) {
            return true;
        }
        return other instanceof GateColumn &&
            seq(this.gates).isEqualTo(seq(other.gates), Util.STRICT_EQUALITY);
    }

    /**
     * @param {!int} qubitCount
     * @returns {!GateColumn}
     */
    static empty(qubitCount) {
        return new GateColumn(Seq.repeat(null, qubitCount).toArray());
    }

    /**
     * @returns {!boolean}
     */
    isEmpty() {
        return this.gates.every(e => e === null);
    }

    /**
     * @returns {!(!(![!int, !int])[])}
     */
    swapPairs() {
        let swapIndices = Seq.
            range(this.gates.length).
            filter(i => this.gates[i] === Gates.Special.SwapHalf).
            toArray();
        if (swapIndices.length !== 2) {
            return [];
        }
        return [swapIndices];
    }

    /**
     * @returns {!Controls}
     */
    controls() {
        return Seq.
            range(this.gates.length).
            map(i =>
                this.gates[i] === Gates.Special.Control ? Controls.bit(i, true) :
                this.gates[i] === Gates.Special.AntiControl ? Controls.bit(i, false) :
                Controls.NONE).
            aggregate(Controls.NONE, (a, e) => a.and(e));
    }

    hasControl() {
        return seq(this.gates).any(gate => gate === Gates.Special.Control || gate === Gates.Special.AntiControl);
    }

    hasCoherentControl(inputMeasureMask) {
        return Seq.range(this.gates.length).any(i =>
            (inputMeasureMask & (1 << i)) === 0 &&
                (this.gates[i] === Gates.Special.Control || this.gates[i] === Gates.Special.AntiControl));
    }

    hasMeasuredControl(inputMeasureMask) {
        return Seq.range(this.gates.length).any(i =>
            (inputMeasureMask & (1 << i)) !== 0 &&
                (this.gates[i] === Gates.Special.Control || this.gates[i] === Gates.Special.AntiControl));
    }

    wiresWithSingleQubitDisplaysMask() {
        return Seq.range(this.gates.length).
            filter(i => this.gates[i] === Gates.Displays.ChanceDisplay ||
                this.gates[i] === Gates.Displays.BlochSphereDisplay ||
                this.gates[i] === Gates.Displays.DensityMatrixDisplay).
            aggregate(0, (a, i) => a | (1 << i));
    }

    wiresWithTwoQubitDisplaysMask() {
        return Seq.range(this.gates.length).
            filter(i => this.gates[i] === Gates.Displays.DensityMatrixDisplay2).
            aggregate(0, (a, i) => a | (1 << i));
    }

    /**
     * @param {!int} inputMeasureMask
     * @param {!int} row
     * @returns {undefined|!string}
     * @private
     */
    _disabledReason(inputMeasureMask, row) {
        let g = this.gates[row];

        if (g === null) {
            return undefined;
        }

        if (g.name === "Parse Error") {
            return "parse\nerror";
        }

        if (g === Gates.Special.Measurement && this.hasControl() && (inputMeasureMask & (1 << row)) === 0) {
            return "can't\ncontrol\n(sorry)";
        }

        if (g === Gates.Special.SwapHalf) {
            let swapRows = Seq.range(this.gates.length).
                filter(row => this.gates[row] === Gates.Special.SwapHalf);
            let n = swapRows.count();
            if (n === 1) {
                return "need\nother\nswap";
            }
            if (n > 2) {
                return "too\nmany\nswap";
            }

            let affectsMeasured = swapRows.any(r => (inputMeasureMask & (1 << r)) !== 0);
            let affectsUnmeasured = swapRows.any(r => (inputMeasureMask & (1 << r)) === 0);
            if (affectsMeasured && this.hasCoherentControl(inputMeasureMask)) {
                return "no\nremix\n(sorry)";
            }
            if (affectsMeasured && affectsUnmeasured && this.hasControl()) {
                return "no\nremix\n(sorry)";
            }
        }

        // Measured qubits can't be re-superposed for implementation simplicity reasons.
        let mask = ((1 << g.height) - 1) << row;
        let maskMeasured = mask & inputMeasureMask;
        if (maskMeasured !== 0) {
            // Pick a time that's unlikely to be on a corner case of a time-based gate.
            // Also this time happens to hit the upstroke on both of the included clock-pulse gates.
            let m = g.matrixAt(0.8234);
            const ε = 0.0001;
            let permutesStates = !m.isDiagonal();
            let createsSuperpositions = !m.isPhasedPermutation(ε);
            let hasCoherentControl = this.hasCoherentControl(inputMeasureMask);
            if (createsSuperpositions || (permutesStates && hasCoherentControl)) {
                return "no\nremix\n(sorry)";
            }
        }

        if (maskMeasured !== 0 && maskMeasured !== mask) {
            return "no\nremix\n(sorry)";
        }

        return undefined;
    }

    minimumRequiredWireCount() {
        return Seq.range(this.gates.length).
            filter(i => this.gates[i] !== null).
            map(i => i + this.gates[i].height).
            max(0);
    }

    maximumGateWidth() {
        return seq(this.gates).
            filter(g => g !== null).
            map(g => g.width).
            max(-Infinity);
    }

    disabledReasons(inputMeasureMask) {
        return Seq.range(this.gates.length).map(i => this._disabledReason(inputMeasureMask, i)).toArray();
    }

    nextMeasureMask(inputMeasureMask, disabledReasons) {
        return Seq.range(this.gates.length).aggregate([inputMeasureMask, undefined], ([measureMask, prevSwap], row) => {
            if (disabledReasons[row] !== undefined) {
                return [measureMask, prevSwap];
            }

            let gate = this.gates[row];
            let bit = 1 << row;

            // The measurement gate measures.
            if (gate === Gates.Special.Measurement) {
                return [measureMask | bit, prevSwap];
            }

            // Post-selection gates un-measure (in that the simulator can then do coherent operations on the qubit
            // without getting the wrong answer, at least).
            if (!this.hasControl() && (gate === Gates.Misc.PostSelectOn || gate === Gates.Misc.PostSelectOff)) {
                return [measureMask & ~bit, prevSwap];
            }

            // Swap gate swaps measurements.
            if (gate === Gates.Special.SwapHalf) {
                if (prevSwap === undefined) {
                    return [measureMask, row];
                }

                let other = 1 << prevSwap;
                let d = row - prevSwap;
                return [
                    (measureMask & ~(other | bit)) | ((measureMask & other) << d) | ((measureMask & bit) >> d),
                    undefined
                ];
            }

            return [measureMask, prevSwap];
        })[0];
    }

    /**
     * @param {!int} startIndex
     * @param {!GateColumn} insertedCol
     * @returns {!GateColumn}
     */
    withGatesAdded(startIndex, insertedCol) {
        if (!Number.isInteger(startIndex) || startIndex < 0
                || startIndex > this.gates.length- insertedCol.gates.length) {
            throw new DetailedError("Bad start index", {baseCol: this, startIndex, insertedCol});
        }
        let gates = this.gates.map(e => e);
        for (let i = 0; i < insertedCol.gates.length; i++) {
            gates[startIndex + i] = insertedCol.gates[i];
        }
        return new GateColumn(gates);
    }
}

export default GateColumn;
