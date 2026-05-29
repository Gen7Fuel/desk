const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const Project = require('./project.model')
const Task = require('./task.model')
const ProjectTemplate = require('./project-template.model')
const { authenticate } = require('../../middleware/auth')

// Seed default template on first load
async function seedDefaultTemplate() {
  const count = await ProjectTemplate.countDocuments()
  if (count > 0) return
  await ProjectTemplate.create({
    name: 'New Site Opening',
    description: 'Standard checklist for opening a new fuel site',
    tasks: [
      { name: 'Site Selection & Lease Negotiation', durationDays: 7, order: 1, dependsOnPrevious: false },
      { name: 'Permits & Licensing', durationDays: 7, order: 2, dependsOnPrevious: true },
      { name: 'Construction / Buildout', durationDays: 7, order: 3, dependsOnPrevious: true },
      { name: 'Equipment Installation', durationDays: 7, order: 4, dependsOnPrevious: true },
      { name: 'Fuel Supply Agreement', durationDays: 7, order: 5, dependsOnPrevious: true },
      { name: 'Staff Hiring & Training', durationDays: 7, order: 6, dependsOnPrevious: true },
      { name: 'POS & Systems Setup', durationDays: 7, order: 7, dependsOnPrevious: true },
      { name: 'Inspections & Compliance', durationDays: 7, order: 8, dependsOnPrevious: true },
      { name: 'Soft Opening', durationDays: 7, order: 9, dependsOnPrevious: true },
      { name: 'Grand Opening', durationDays: 7, order: 10, dependsOnPrevious: true },
    ],
  })
}
seedDefaultTemplate().catch(console.error)

// ── Templates ────────────────────────────────────────────────────────────────

router.get('/projects/templates', authenticate, async (req, res) => {
  try {
    const templates = await ProjectTemplate.find().select('name description').sort({ name: 1 })
    res.json({ templates })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/projects/templates/:id', authenticate, async (req, res) => {
  try {
    const template = await ProjectTemplate.findById(req.params.id)
    if (!template) return res.status(404).json({ error: 'Not found' })
    res.json({ template })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Projects ─────────────────────────────────────────────────────────────────

router.get('/projects', authenticate, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 })
    res.json({ projects })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/projects', authenticate, async (req, res) => {
  try {
    const { name, site, description, status, startDate, templateId } = req.body
    if (!name || !startDate) return res.status(400).json({ error: 'name and startDate are required' })

    const project = await Project.create({
      name,
      site,
      description,
      status,
      startDate,
      createdBy: req.user.userId,
    })

    if (templateId) {
      const template = await ProjectTemplate.findById(templateId)
      if (template && template.tasks.length > 0) {
        const sorted = [...template.tasks].sort((a, b) => a.order - b.order)
        let cursor = new Date(startDate)
        const taskDocs = sorted.map((t) => {
          const taskStart = new Date(cursor)
          const taskEnd = new Date(cursor)
          taskEnd.setDate(taskEnd.getDate() + t.durationDays)
          if (t.dependsOnPrevious) cursor = new Date(taskEnd)
          return {
            projectId: project._id,
            name: t.name,
            startDate: taskStart,
            endDate: taskEnd,
            order: t.order,
          }
        })
        await Task.insertMany(taskDocs)
      }
    }

    res.status(201).json({ project })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.get('/projects/:id', authenticate, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate('createdBy', 'firstName lastName')
    if (!project) return res.status(404).json({ error: 'Not found' })
    const tasks = await Task.find({ projectId: req.params.id })
      .populate('assignee', 'firstName lastName')
      .sort({ order: 1, createdAt: 1 })
    res.json({ project, tasks })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/projects/:id', authenticate, async (req, res) => {
  try {
    const { name, site, description, status, startDate } = req.body
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { name, site, description, status, startDate },
      { new: true, runValidators: true }
    )
    if (!project) return res.status(404).json({ error: 'Not found' })
    res.json({ project })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/projects/:id', authenticate, async (req, res) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id)
    if (!project) return res.status(404).json({ error: 'Not found' })
    await Task.deleteMany({ projectId: req.params.id })
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Tasks ─────────────────────────────────────────────────────────────────────

router.get('/projects/:id/tasks', authenticate, async (req, res) => {
  try {
    const tasks = await Task.find({ projectId: req.params.id })
      .populate('assignee', 'firstName lastName')
      .sort({ order: 1, createdAt: 1 })
    res.json({ tasks })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/projects/:id/tasks', authenticate, async (req, res) => {
  try {
    const { name, startDate, endDate, progress, assignee, dependencies, order, status, notes } = req.body
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'name, startDate, and endDate are required' })
    }
    const task = await Task.create({
      projectId: req.params.id,
      name,
      startDate,
      endDate,
      progress,
      assignee: assignee || null,
      dependencies: dependencies || [],
      order: order ?? 0,
      status,
      notes,
    })
    const populated = await task.populate('assignee', 'firstName lastName')
    res.status(201).json({ task: populated })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.put('/projects/:id/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const { name, startDate, endDate, progress, assignee, dependencies, order, status, notes } = req.body
    const task = await Task.findOneAndUpdate(
      { _id: req.params.taskId, projectId: req.params.id },
      { name, startDate, endDate, progress, assignee: assignee ?? undefined, dependencies, order, status, notes },
      { new: true, runValidators: true }
    ).populate('assignee', 'firstName lastName')
    if (!task) return res.status(404).json({ error: 'Not found' })
    res.json({ task })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.delete('/projects/:id/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.taskId, projectId: req.params.id })
    if (!task) return res.status(404).json({ error: 'Not found' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
