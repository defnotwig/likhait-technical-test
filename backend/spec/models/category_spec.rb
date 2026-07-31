require 'rails_helper'

RSpec.describe Category, type: :model do
  describe "validations" do
    it "accepts a valid Unicode category name" do
      expect(described_class.new(name: "食費")).to be_valid
    end

    it "requires a name" do
      category = described_class.new(name: "   ")

      expect(category).not_to be_valid
      expect(category.errors[:name]).to include("can't be blank")
    end

    it "limits names to the database column length" do
      category = described_class.new(name: "a" * 101)

      expect(category).not_to be_valid
      expect(category.errors[:name]).to include("is too long (maximum is 100 characters)")
    end

    it "enforces case-insensitive uniqueness" do
      described_class.create!(name: "Subscriptions")

      duplicate = described_class.new(name: " subscriptions ")

      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:name]).to include("has already been taken")
    end
  end
end
