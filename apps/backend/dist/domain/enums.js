"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlagiarismStatus = exports.TestCaseStatus = exports.SubmissionStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["LECTURER"] = "LECTURER";
    UserRole["STUDENT"] = "STUDENT";
})(UserRole || (exports.UserRole = UserRole = {}));
var SubmissionStatus;
(function (SubmissionStatus) {
    SubmissionStatus["QUEUED"] = "QUEUED";
    SubmissionStatus["RUNNING"] = "RUNNING";
    SubmissionStatus["COMPLETED"] = "COMPLETED";
    SubmissionStatus["COMPILE_ERROR"] = "COMPILE_ERROR";
    SubmissionStatus["FAILED"] = "FAILED";
})(SubmissionStatus || (exports.SubmissionStatus = SubmissionStatus = {}));
var TestCaseStatus;
(function (TestCaseStatus) {
    TestCaseStatus["ACCEPTED"] = "ACCEPTED";
    TestCaseStatus["WRONG_ANSWER"] = "WRONG_ANSWER";
    TestCaseStatus["TIME_LIMIT_EXCEEDED"] = "TIME_LIMIT_EXCEEDED";
    TestCaseStatus["MEMORY_LIMIT_EXCEEDED"] = "MEMORY_LIMIT_EXCEEDED";
    TestCaseStatus["RUNTIME_ERROR"] = "RUNTIME_ERROR";
})(TestCaseStatus || (exports.TestCaseStatus = TestCaseStatus = {}));
var PlagiarismStatus;
(function (PlagiarismStatus) {
    PlagiarismStatus["SUSPECTED"] = "SUSPECTED";
    PlagiarismStatus["CONFIRMED"] = "CONFIRMED";
    PlagiarismStatus["DISMISSED"] = "DISMISSED";
})(PlagiarismStatus || (exports.PlagiarismStatus = PlagiarismStatus = {}));
