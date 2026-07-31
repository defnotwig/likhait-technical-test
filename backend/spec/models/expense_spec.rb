require 'rails_helper'

RSpec.describe Expense, type: :model do
  let(:category) { Category.create!(name: "Food") }
  let(:today) { Date.new(2026, 7, 31) }

  before do
    allow(Date).to receive(:current).and_return(today)
  end

  def build_expense(overrides = {})
    described_class.new(
      {
        description: "Lunch",
        amount: 10,
        category: category,
        date: today
      }.merge(overrides)
    )
  end

  it "accepts yesterday" do
    expect(build_expense(date: today - 1.day)).to be_valid
  end

  it "accepts today" do
    expect(build_expense(date: today)).to be_valid
  end

  it "rejects tomorrow" do
    expense = build_expense(date: today + 1.day)

    expect(expense).not_to be_valid
    expect(expense.errors.full_messages).to include("Date cannot be in the future")
  end

  it "rejects a blank date" do
    expect(build_expense(date: nil)).not_to be_valid
  end

  it "rejects a blank description" do
    expect(build_expense(description: "")).not_to be_valid
  end

  it "rejects a description longer than the database column" do
    expect(build_expense(description: "a" * 256)).not_to be_valid
  end

  it "rejects zero and negative amounts" do
    expect(build_expense(amount: 0)).not_to be_valid
    expect(build_expense(amount: -1)).not_to be_valid
  end

  it "uses the application date at a year boundary" do
    allow(Date).to receive(:current).and_return(Date.new(2026, 12, 31))

    expense = build_expense(date: Date.new(2027, 1, 1))

    expect(expense).not_to be_valid
    expect(expense.errors.full_messages).to include("Date cannot be in the future")
  end
end
