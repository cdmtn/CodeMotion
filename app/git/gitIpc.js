const { ipcMain } = require("electron")
const { GitRepositoryService, handleGitAction } = require("./GitRepositoryService.js")

const gitService = new GitRepositoryService()

function registerGitIpc() {
    ipcMain.handle("git-status", (_, rootPath) => handleGitAction(() => gitService.status(rootPath)))
    ipcMain.handle("git-log", (_, rootPath, limit) => handleGitAction(() => gitService.log(rootPath, limit)))
    ipcMain.handle("git-graph", (_, rootPath, limit) => handleGitAction(() => gitService.graph(rootPath, limit)))
    ipcMain.handle("git-branches", (_, rootPath) => handleGitAction(() => gitService.branches(rootPath)))
    ipcMain.handle("git-diff", (_, rootPath, options) => handleGitAction(() => gitService.diff(rootPath, options || {})))
    ipcMain.handle("git-commit-diff", (_, rootPath, options) => handleGitAction(() => gitService.commitDiff(rootPath, options || {})))
    ipcMain.handle("git-blame", (_, rootPath, filePath) => handleGitAction(() => gitService.blame(rootPath, filePath)))
    ipcMain.handle("git-stage", (_, rootPath, filePath) => handleGitAction(() => gitService.stage(rootPath, filePath)))
    ipcMain.handle("git-unstage", (_, rootPath, filePath) => handleGitAction(() => gitService.unstage(rootPath, filePath)))
    ipcMain.handle("git-stage-all", (_, rootPath) => handleGitAction(() => gitService.stageAll(rootPath)))
    ipcMain.handle("git-unstage-all", (_, rootPath) => handleGitAction(() => gitService.unstageAll(rootPath)))
    ipcMain.handle("git-discard", (_, rootPath, filePath, options) => handleGitAction(() => gitService.discard(rootPath, filePath, options || {})))
    ipcMain.handle("git-restore", (_, rootPath, filePath) => handleGitAction(() => gitService.restore(rootPath, filePath)))
    ipcMain.handle("git-commit", (_, rootPath, message) => handleGitAction(() => gitService.commit(rootPath, message)))
    ipcMain.handle("git-checkout", (_, rootPath, branch) => handleGitAction(() => gitService.checkout(rootPath, branch)))
    ipcMain.handle("git-create-branch", (_, rootPath, branch, checkout) => handleGitAction(() => gitService.createBranch(rootPath, branch, checkout)))
    ipcMain.handle("git-delete-branch", (_, rootPath, branch) => handleGitAction(() => gitService.deleteBranch(rootPath, branch)))
    ipcMain.handle("git-rename-branch", (_, rootPath, oldName, newName) => handleGitAction(() => gitService.renameBranch(rootPath, oldName, newName)))
    ipcMain.handle("git-fetch", (_, rootPath) => handleGitAction(() => gitService.fetch(rootPath)))
    ipcMain.handle("git-pull", (_, rootPath) => handleGitAction(() => gitService.pull(rootPath)))
    ipcMain.handle("git-push", (_, rootPath, currentOnly) => handleGitAction(() => gitService.push(rootPath, currentOnly)))
    ipcMain.handle("git-merge", (_, rootPath, branch) => handleGitAction(() => gitService.merge(rootPath, branch)))
    ipcMain.handle("git-rebase", (_, rootPath, branch) => handleGitAction(() => gitService.rebase(rootPath, branch)))
    ipcMain.handle("git-has-changes", (_, rootPath) => handleGitAction(() => gitService.hasUncommittedChanges(rootPath)))
}

module.exports = {
    registerGitIpc
}
