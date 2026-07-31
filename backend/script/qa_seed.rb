unless ENV["QA_EPHEMERAL_DATABASE"] == "1"
  abort "Refusing to seed without QA_EPHEMERAL_DATABASE=1"
end

target_count = Integer(ENV.fetch("QA_EXPENSE_COUNT", "10000"), 10)
abort "QA_EXPENSE_COUNT must be between 0 and 100000" unless (0..100_000).cover?(target_count)

category_names = [
  "Food", "Transportation", "Shopping", "Entertainment", "Bills",
  "Healthcare", "Education", "Travel", "Personal", "Other"
]

# db:prepare loads the application's demo seed data for a new production-mode
# database. This script is guarded above and only runs against the disposable QA
# database, so reset it to a deterministic dataset before measuring anything.
Expense.delete_all
Category.delete_all

category_names.each { |name| Category.create!(name: name) }
category_ids = Category.order(:id).limit(category_names.length).pluck(:id)

now = Time.current.change(usec: 0)
rows = []

target_count.times do |index|
  date = Date.new(2025, (index % 12) + 1, (index % 28) + 1)
  rows << {
    description: format("QA-SEED-%06d", index),
    amount: ((index % 50_000) + 1) / 100.0,
    category_id: category_ids[index % category_ids.length],
    date: date,
    created_at: now - (index % 3600).seconds,
    updated_at: now
  }

  if rows.length == 1_000
    Expense.insert_all!(rows)
    rows.clear
  end
end

Expense.insert_all!(rows) if rows.any?

puts({ seeded_expenses: target_count, categories: Category.count, seed: ENV.fetch("QA_SEED", "20260801") }.to_json)
