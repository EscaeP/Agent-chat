import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 定义待办事项的Pinia store
export const useTodoStore = defineStore('todo', () => {
  // 【Vue核心概念：响应式数据】
  // 使用ref创建响应式数据
  const todos = ref([
    { id: 1, text: '学习Vue 3', completed: false },
    { id: 2, text: '创建Todo应用', completed: false },
    { id: 3, text: '集成路由和状态管理', completed: true }
  ])

  // 【新增功能：多选批量删除】
  // 使用Set数据结构存储选中的待办事项ID
  const selectedTodoIds = ref(new Set())

  // 计算属性：剩余待办事项数量
  const remainingCount = computed(() => {
    return todos.value.filter(todo => !todo.completed).length
  })

  // 计算属性：是否所有待办事项都已完成
  const isAllCompleted = computed(() => {
    return todos.value.length > 0 && todos.value.every(todo => todo.completed)
  })

  // 计算属性：是否全选
  const isAllSelected = computed(() => {
    return todos.value.length > 0 && selectedTodoIds.value.size === todos.value.length
  })

  // 计算属性：是否有选中项
  const hasSelectedTodos = computed(() => {
    return selectedTodoIds.value.size > 0
  })

  // 添加待办事项的方法
  const addTodo = (text) => {
    // 输入验证：去除前后空格后检查是否为空
    const trimmedText = text.trim()
    if (trimmedText) {
      todos.value.push({
        id: Date.now(), // 使用时间戳作为唯一ID
        text: trimmedText,
        completed: false
      })
    }
  }

  // 删除待办事项的方法
  const deleteTodo = (id) => {
    todos.value = todos.value.filter(todo => todo.id !== id)
    // 从选中列表中移除
    selectedTodoIds.value.delete(id)
  }

  // 切换待办事项完成状态的方法
  const toggleTodo = (id) => {
    const todo = todos.value.find(todo => todo.id === id)
    if (todo) {
      todo.completed = !todo.completed
    }
  }

  // 切换所有待办事项的完成状态
  const toggleAllTodos = () => {
    const newCompletedState = !isAllCompleted.value
    todos.value.forEach(todo => {
      todo.completed = newCompletedState
    })
  }

  // 切换待办事项的选中状态
  const toggleTodoSelection = (id) => {
    if (selectedTodoIds.value.has(id)) {
      selectedTodoIds.value.delete(id)
    } else {
      selectedTodoIds.value.add(id)
    }
  }

  // 切换所有待办事项的选中状态
  const toggleAllSelection = () => {
    if (isAllSelected.value) {
      selectedTodoIds.value.clear()
    } else {
      selectedTodoIds.value = new Set(todos.value.map(todo => todo.id))
    }
  }

  // 批量删除选中的待办事项
  const batchDeleteTodos = () => {
    todos.value = todos.value.filter(todo => !selectedTodoIds.value.has(todo.id))
    selectedTodoIds.value.clear()
  }

  // 返回store的状态和方法
  return {
    todos,
    selectedTodoIds,
    remainingCount,
    isAllCompleted,
    isAllSelected,
    hasSelectedTodos,
    addTodo,
    deleteTodo,
    toggleTodo,
    toggleAllTodos,
    toggleTodoSelection,
    toggleAllSelection,
    batchDeleteTodos
  }
})
